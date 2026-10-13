import { createHash } from "node:crypto";
import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { befriend, createRoom, createUser, dbAvailable, signIn } from "./auth-helpers";

test.skip(!dbAvailable, "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

async function addLink(roomId: string, createdById: string, token: string, revoked = false) {
  await getDb().roomInviteLink.create({
    data: {
      roomId,
      createdById,
      token,
      tokenHash: sha(token),
      expiresAt: new Date(Date.now() + 3_600_000),
      revokedAt: revoked ? new Date() : null,
    },
  });
}

test.describe("rooms", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("creates a room with a searchable topic, a type and a plain who-can-join choice", async ({
    page,
    context,
  }) => {
    await signIn(context, await createUser("rm1"));
    await page.goto("/app/rooms?new=1");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Room name").fill("Late night gist");

    // The old wording is gone.
    await expect(dialog.getByText("Anyone", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Invited people only")).toHaveCount(0);
    await expect(dialog.getByRole("radio", { name: "Public" })).toBeVisible();
    await expect(dialog.getByText("Anyone can find this room and join it.")).toBeVisible();

    await dialog.getByRole("combobox", { name: "Topic" }).click();
    await page.getByRole("textbox", { name: "Search topics" }).fill("foot");
    await page.getByRole("option", { name: "Football" }).click();
    await expect(dialog.getByRole("combobox", { name: "Topic" })).toContainText("Football");

    await dialog.getByRole("radio", { name: "Video" }).click();
    await dialog.getByRole("radio", { name: "Private" }).click();
    await expect(dialog.getByText("Only people you invite", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Start room" }).click();

    await page.waitForURL(/\/app\/rooms\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: "Late night gist" })).toBeVisible();
    const row = await getDb().room.findFirstOrThrow({
      where: { title: "Late night gist" },
      include: { topic: true },
    });
    expect(row.media).toBe("VIDEO");
    expect(row.visibility).toBe("PRIVATE");
    expect(row.topic?.slug).toBe("football");
  });

  test("an ended room says so, and only people who were in it see the summary and their notes", async ({
    browser,
  }) => {
    const host = await createUser("rm2", { name: "Host Hakeem" });
    const guest = await createUser("rm3", { name: "Guest Gloria" });
    const outsider = await createUser("rm4");
    const room = await createRoom(host, {
      title: "Ended chat",
      topic: "football",
      members: [{ person: guest, state: "JOINED" }],
    });
    const started = new Date(Date.now() - 3_600_000);
    await getDb().room.update({
      where: { id: room.id },
      data: {
        status: "ENDED",
        startedAt: started,
        endedAt: new Date(),
        peakParticipants: 7,
        messageCount: 31,
        reactionCount: 12,
      },
    });
    await getDb().note.create({
      data: { userId: guest.user.id, roomId: room.id, body: "Remember the Friday match" },
    });

    const outsiderCtx = await browser.newContext();
    await signIn(outsiderCtx, outsider);
    const o = await outsiderCtx.newPage();
    await o.goto(`/app/rooms/${room.slug}`);
    await expect(o.getByRole("heading", { name: "This room has ended" })).toBeVisible();
    await expect(o.getByRole("link", { name: "Browse live rooms" })).toBeVisible();
    await expect(o.getByText("Who was here")).toHaveCount(0);
    await expect(o.getByText("Remember the Friday match")).toHaveCount(0);
    await outsiderCtx.close();

    const guestCtx = await browser.newContext();
    await signIn(guestCtx, guest);
    const g = await guestCtx.newPage();
    await g.goto(`/app/rooms/${room.slug}`);
    await expect(g.getByRole("heading", { name: "This room has ended" })).toBeVisible();
    await expect(g.getByText("Ended chat")).toBeVisible();
    await expect(g.getByText("Most people at once")).toBeVisible();
    await expect(g.getByText("31", { exact: true })).toBeVisible();
    await expect(g.getByText("Who was here")).toBeVisible();
    await expect(g.getByText("Host Hakeem").first()).toBeVisible();
    await expect(g.getByText("Remember the Friday match")).toBeVisible();
    await expect(g.getByText("Moderator actions")).toHaveCount(0);

    // The same record sits under Past rooms.
    await g.goto("/app/rooms/past");
    await expect(g.getByRole("heading", { name: "Past rooms" })).toBeVisible();
    await g.getByRole("button", { name: /Ended chat/ }).click();
    await expect(g.getByText("Remember the Friday match")).toBeVisible();
    await guestCtx.close();
  });

  test("invite links: a good one lets you in, a revoked one stops, signed out people sign in first", async ({
    page,
    context,
    browser,
  }) => {
    const host = await createUser("rm5");
    const guest = await createUser("rm6");
    const room = await createRoom(host, { title: "Closed door", visibility: "PRIVATE" });
    await addLink(room.id, host.user.id, "good-token-0001");
    await addLink(room.id, host.user.id, "dead-token-0002", true);

    await signIn(context, guest);
    await page.goto(`/rooms/${room.slug}?invite=good-token-0001`);
    await page.waitForURL(/\/app\/rooms\//);
    await expect(page.getByRole("heading", { name: "Closed door" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Join room" })).toBeVisible();

    await page.goto(`/rooms/${room.slug}?invite=dead-token-0002`);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("This link was turned off");
    await expect(dialog).toContainText("Ask the host for a new link.");
    await expect(page.getByText("Closed door")).toHaveCount(0);

    const anon = await browser.newContext();
    const a = await anon.newPage();
    await a.goto(`/rooms/${room.slug}?invite=good-token-0001`);
    await a.waitForURL(/\/login\?next=/);
    expect(decodeURIComponent(new URL(a.url()).searchParams.get("next") ?? "")).toContain(
      `/app/rooms/${room.slug}?invite=good-token-0001`,
    );
    await anon.close();
  });

  test("a locked room says it is locked right now", async ({ page, context }) => {
    const host = await createUser("rm7");
    const guest = await createUser("rm8");
    const room = await createRoom(host, { title: "Door shut" });
    await getDb().room.update({ where: { id: room.id }, data: { locked: true } });
    await signIn(context, guest);
    await page.goto(`/app/rooms/${room.slug}`);
    await page.getByRole("button", { name: "Join room" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("This room is locked");
  });

  test("notes: an empty note list offers Add note, and the counter shows with the input only", async ({
    page,
    context,
  }) => {
    const me = await createUser("rm9");
    const friend = await createUser("rm10", { name: "Note Friend" });
    const conversationId = await befriend(me, friend);
    await signIn(context, me);
    await page.goto(`/app/chats/${conversationId}`);
    await page.getByRole("button", { name: "Notes" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Notes are private to you")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "No notes yet" })).toBeVisible();
    await expect(
      dialog.getByText("Write down a name, a time or a thing you want to remember."),
    ).toBeVisible();
    await expect(dialog.getByText(/of 2000/)).toHaveCount(0);

    await dialog.getByRole("button", { name: "Add note" }).click();
    await expect(dialog.getByRole("heading", { name: "No notes yet" })).toHaveCount(0);
    const input = dialog.getByRole("textbox");
    await expect(input).toBeFocused();
    await expect(dialog.getByText("0 of 2000")).toBeVisible();
    await input.fill("Call back on Friday");
    await dialog.getByRole("button", { name: "Save note" }).click();
    await expect(dialog.getByText("Call back on Friday")).toBeVisible();
    await expect(dialog.getByText(/of 2000/)).toHaveCount(0);
  });
});
