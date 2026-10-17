import { expect as baseExpect, test, type Page } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { befriend, createRoom, createUser, signIn, type E2eUser } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 25_000 });

// There is no realtime service behind the test server, so the ring window finds rings by asking the server, which is the
// same path a reload or a missed socket event takes. The sockets only make it quicker.

async function ringCall(
  caller: E2eUser,
  callee: E2eUser,
  over: { media?: "AUDIO" | "VIDEO"; inSec?: number } = {},
) {
  return getDb().call.create({
    data: {
      callerId: caller.user.id,
      calleeId: callee.user.id,
      initialMedia: over.media ?? "AUDIO",
      status: "RINGING",
      livekitRoom: `e2e_call_${Math.random().toString(36).slice(2)}`,
      ringExpiresAt: new Date(Date.now() + (over.inSec ?? 40) * 1000),
    },
  });
}

const ring = (page: Page) => page.locator("[data-ring-window]");

async function pair(key: string) {
  const caller = await createUser(`rc${key}`, { name: "Ada Okafor" });
  const callee = await createUser(`re${key}`, { name: "Tunde Bello" });
  await befriend(caller, callee);
  return { caller, callee };
}

test.describe("incoming calls ring in the window", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const path of ["/app/discover", "/app/settings", "/app/rooms"]) {
    test(`rings on ${path} without changing the address`, async ({ page, context }) => {
      const { caller, callee } = await pair(`a${path.length}`);
      await signIn(context, callee);
      await page.goto(path);
      // Some pages redirect to a default tab, so the address to keep is the one the page settled on.
      await page.waitForLoadState("networkidle");
      const here = new URL(page.url()).pathname;
      await ringCall(caller, callee);
      const card = ring(page).locator('[data-ring-card="CALL"]');
      await expect(card).toBeVisible();
      await expect(card).toContainText("Ada Okafor");
      await expect(card).toContainText("Incoming audio call");
      expect(new URL(page.url()).pathname).toBe(here);
      // Top right, below the header.
      const box = await card.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(1280 - 40);
      expect(box?.y ?? 0).toBeGreaterThan(60);
      // Not modal, and not announced as a page.
      await expect(ring(page)).toHaveAttribute("aria-modal", "false");
      await expect(ring(page)).toHaveAttribute("role", "dialog");
    });
  }

  test("answering opens the call window and the address stays", async ({ page, context }) => {
    const { caller, callee } = await pair("b");
    await signIn(context, callee);
    await page.goto("/app/discover");
    const call = await ringCall(caller, callee);
    await ring(page).getByRole("button", { name: "Answer", exact: true }).click();
    await expect(page.getByTestId("call-window")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/app/discover");
    await expect(ring(page)).toHaveCount(0);
    await expect
      .poll(async () => (await getDb().call.findUniqueOrThrow({ where: { id: call.id } })).status)
      .toBe("ACTIVE");
  });

  test("a video call offers both answers and no picture of the caller", async ({
    page,
    context,
  }) => {
    const { caller, callee } = await pair("c");
    await signIn(context, callee);
    await page.goto("/app/settings");
    await ringCall(caller, callee, { media: "VIDEO" });
    const card = ring(page).locator('[data-ring-card="CALL"]');
    await expect(card).toContainText("Incoming video call");
    await expect(card.getByRole("button", { name: "Answer with video" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Answer with audio only" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Decline" })).toBeVisible();
    await expect(card.locator("video")).toHaveCount(0);
  });

  test("declining closes it and logs the call for both people", async ({ page, context }) => {
    const { caller, callee } = await pair("d");
    await signIn(context, callee);
    await page.goto("/app/chats");
    const call = await ringCall(caller, callee);
    await ring(page).getByRole("button", { name: "Decline" }).click();
    await expect(ring(page)).toHaveCount(0);
    await expect
      .poll(async () => (await getDb().call.findUniqueOrThrow({ where: { id: call.id } })).status)
      .toBe("DECLINED");
    await expect
      .poll(() =>
        getDb().callLogEntry.count({ where: { userId: { in: [caller.user.id, callee.user.id] } } }),
      )
      .toBe(2);
  });

  test("a caller who hangs up first leaves a Missed call note for three seconds", async ({
    page,
    context,
  }) => {
    const { caller, callee } = await pair("e");
    await signIn(context, callee);
    await page.goto("/app/chats");
    const call = await ringCall(caller, callee);
    await expect(ring(page).locator('[data-ring-card="CALL"]')).toBeVisible();
    await getDb().call.update({
      where: { id: call.id },
      data: { status: "CANCELLED", endedAt: new Date(), endReason: "caller-cancelled" },
    });
    await expect(ring(page)).toContainText("Missed call from Ada Okafor");
    await expect(ring(page)).toHaveCount(0, { timeout: 15_000 });
  });

  test("closes when it rings out, and the call is missed", async ({ page, context }) => {
    const { caller, callee } = await pair("f");
    await signIn(context, callee);
    await page.goto("/app/chats");
    const call = await ringCall(caller, callee, { inSec: 6 });
    await expect(ring(page).locator('[data-ring-card="CALL"]')).toBeVisible();
    await expect(ring(page)).toHaveCount(0, { timeout: 20_000 });
    await expect
      .poll(async () => (await getDb().call.findUniqueOrThrow({ where: { id: call.id } })).status)
      .toBe("MISSED");
  });

  test("stacks three cards, newest on top, with a count for the rest", async ({
    page,
    context,
  }) => {
    const callee = await createUser("rsx", { name: "Tunde Bello" });
    await signIn(context, callee);
    await page.goto("/app/chats");
    for (let i = 0; i < 4; i += 1) {
      const caller = await createUser(`rs${i}`, { name: `Caller ${i}` });
      await ringCall(caller, callee);
      await new Promise((r) => setTimeout(r, 30));
    }
    const cards = ring(page).locator("[data-ring-card]");
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText("Caller 3");
    await expect(ring(page).getByText("+1 more")).toBeVisible();
  });

  test("another tab hears it went elsewhere and says so", async ({ browser, context, page }) => {
    const { caller, callee } = await pair("g");
    await signIn(context, callee);
    await page.goto("/app/chats");
    const second = await context.newPage();
    await second.goto("/app/settings");
    const call = await ringCall(caller, callee);
    await expect(ring(page).locator('[data-ring-card="CALL"]')).toBeVisible();
    await expect(ring(second).locator('[data-ring-card="CALL"]')).toBeVisible();
    await ring(page).getByRole("button", { name: "Answer", exact: true }).click();
    await expect(ring(second)).toHaveCount(0);
    await expect(second.getByText("Answered on another device")).toBeVisible();
    expect(call.id.length).toBeGreaterThan(3);
    void browser;
  });

  test("nothing rings in quiet hours", async ({ page, context }) => {
    const { caller, callee } = await pair("h");
    await getDb().user.update({ where: { id: callee.user.id }, data: { timezone: "UTC" } });
    await getDb().notificationPreference.create({
      data: {
        userId: callee.user.id,
        switches: {},
        previews: true,
        quietStart: "00:00",
        quietEnd: "23:59",
      },
    });
    await signIn(context, callee);
    await page.goto("/app/chats");
    await ringCall(caller, callee);
    await page.waitForTimeout(6_000);
    await expect(ring(page)).toHaveCount(0);
  });

  test("a reload brings the ring back with the right time left", async ({ page, context }) => {
    const { caller, callee } = await pair("i");
    await signIn(context, callee);
    await page.goto("/app/chats");
    await ringCall(caller, callee, { inSec: 30 });
    const card = ring(page).locator('[data-ring-card="CALL"]');
    await expect(card).toBeVisible();
    const left = async () =>
      Number(
        ((await card.locator("span[aria-hidden]").last().textContent()) ?? "").replace(/\D/g, ""),
      );
    const first = await left();
    expect(first).toBeLessThanOrEqual(30);
    expect(first).toBeGreaterThan(18);
    await page.waitForTimeout(3_000);
    await page.reload();
    await expect(ring(page).locator('[data-ring-card="CALL"]')).toBeVisible();
    const second = await left();
    expect(second).toBeLessThan(first);
  });

  test("ignores the saved window place and does not take focus from a text box", async ({
    page,
    context,
  }) => {
    const { caller, callee } = await pair("j");
    await signIn(context, callee);
    await page.goto("/app/chats");
    await page.evaluate((id) => {
      window.localStorage.setItem(
        `gr_callwindow:${id}`,
        JSON.stringify({ x: 10, y: 400, w: 400, h: 300 }),
      );
    }, callee.user.id);
    await page.goto("/app/settings");
    const box = page.getByRole("textbox").first();
    await box.focus();
    await ringCall(caller, callee);
    const card = ring(page).locator('[data-ring-card="CALL"]');
    await expect(card).toBeVisible();
    const pos = await card.boundingBox();
    expect((pos?.x ?? 0) + (pos?.width ?? 0)).toBeGreaterThan(1280 - 40);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("INPUT");
  });
});

test.describe("rooms ringing you", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function roomRing(key: string) {
    const host = await createUser(`rh${key}`, { name: "Room Host" });
    const guest = await createUser(`rg${key}`, { name: "Room Guest" });
    await befriend(host, guest);
    const room = await createRoom(host, { title: "Match day gist", topic: "football" });
    const db = getDb();
    await db.roomMember.create({
      data: {
        roomId: room.id,
        userId: guest.user.id,
        state: "INVITED",
        invitedById: host.user.id,
        ringStatus: "RINGING",
        ringedAt: new Date(),
      },
    });
    return { host, guest, room };
  }

  test("shows the room, who rings, how many are inside, and Join opens the window", async ({
    page,
    context,
  }) => {
    const { guest, room } = await roomRing("a");
    await signIn(context, guest);
    await page.goto("/app/discover");
    const card = ring(page).locator('[data-ring-card="ROOM"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText("Room Host is ringing you");
    await expect(card).toContainText("Match day gist");
    await expect(card).toContainText("Football");
    await expect(card).toContainText("English");
    await expect(card).toContainText("1 person inside");
    await expect(card.getByRole("button", { name: "Decline" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Don't ring me for this room" })).toBeVisible();
    await card.getByRole("button", { name: "Join" }).click();
    await expect(page.getByTestId("call-window")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/app/discover");
    expect(room.slug.length).toBeGreaterThan(3);
  });

  test("looks like a call card, the same width and frame", async ({ page, context }) => {
    const { guest } = await roomRing("b");
    const caller = await createUser("rpb", { name: "Ada Okafor" });
    await signIn(context, guest);
    await page.goto("/app/discover");
    await ringCall(caller, guest);
    const room = ring(page).locator('[data-ring-card="ROOM"]');
    const call = ring(page).locator('[data-ring-card="CALL"]');
    await expect(room).toBeVisible();
    await expect(call).toBeVisible();
    const [a, b] = [await room.boundingBox(), await call.boundingBox()];
    expect(Math.round(a?.width ?? 0)).toBe(Math.round(b?.width ?? 1));
    expect(await room.evaluate((el) => el.className.includes("rounded-hero"))).toBe(true);
    expect(await call.evaluate((el) => el.className.includes("rounded-hero"))).toBe(true);
  });

  test("updates in place when the room locks, fills or ends", async ({ page, context }) => {
    const { guest, room } = await roomRing("c");
    await signIn(context, guest);
    await page.goto("/app/discover");
    const card = ring(page).locator('[data-ring-card="ROOM"]');
    await expect(card.getByRole("button", { name: "Join" })).toBeEnabled();
    await getDb().room.update({ where: { id: room.id }, data: { locked: true } });
    await expect(card).toContainText("This room is locked right now");
    await expect(card.getByRole("button", { name: "Join" })).toBeDisabled();
    await getDb().room.update({
      where: { id: room.id },
      data: { locked: false, status: "ENDED", endedAt: new Date() },
    });
    await expect(card).toContainText("This room has ended");
    await expect(card.getByRole("button", { name: "Join" })).toBeDisabled();
  });

  test("Decline and Don't ring me are remembered", async ({ page, context }) => {
    const { guest, room } = await roomRing("d");
    await signIn(context, guest);
    await page.goto("/app/chats");
    const card = ring(page).locator('[data-ring-card="ROOM"]');
    await card.getByRole("button", { name: "Don't ring me for this room" }).click();
    await expect(ring(page)).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (
            await getDb().roomMember.findFirstOrThrow({
              where: { roomId: room.id, userId: guest.user.id },
            })
          ).noRing,
      )
      .toBe(true);
  });

  test("a person already in a room is not rung, only told quietly", async ({ page, context }) => {
    const other = await createUser("rbh", { name: "Other Host" });
    const { guest } = await roomRing("e");
    const busyRoom = await createRoom(other, { title: "Already in this", topic: "comedy" });
    await signIn(context, guest);
    await page.goto(`/app/rooms/${busyRoom.slug}`);
    await page.getByTestId("call-window").getByRole("button", { name: "Join room" }).click();
    await expect(page.getByTestId("call-window")).toBeVisible();
    // The room that was ringing is not shown while this one is on.
    await expect(ring(page).locator('[data-ring-card="ROOM"]')).toHaveCount(0);
    await expect(page.getByText("Room Host invited you to Match day gist")).toBeVisible();
  });
});

test.describe("rings on a phone", () => {
  for (const size of [
    { width: 390, height: 800 },
    { width: 360, height: 740 },
  ]) {
    test(`is a heads-up card that opens a full-screen answer screen at ${size.width}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(size);
      const caller = await createUser(`rpc${size.width}`, { name: "Ada Okafor" });
      const callee = await createUser(`rpe${size.width}`, { name: "Tunde Bello" });
      await befriend(caller, callee);
      await signIn(context, callee);
      await page.goto("/app/chats");
      await ringCall(caller, callee, { media: "VIDEO" });
      const card = ring(page).locator('[data-ring-card="CALL"]');
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(size.width - 24);
      expect(box?.y ?? 99).toBeLessThan(40);
      // Tapping the name opens the full screen answer screen, and a video call keeps both answers.
      await card.getByRole("button", { name: "Open the answer screen" }).click();
      const full = page.locator('[data-ring-card="CALL"]').last();
      await expect(full.getByRole("button", { name: "Answer with video" })).toBeVisible();
      await expect(full.getByRole("button", { name: "Answer with audio only" })).toBeVisible();
      const fb = await full.boundingBox();
      expect(fb?.width ?? 0).toBeGreaterThanOrEqual(size.width - 1);
    });
  }
});
