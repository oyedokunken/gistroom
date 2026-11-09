import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { befriend, createRoom, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

// Screen sharing lives on the room stage and in the call screen, and both need a real LiveKit project to connect.
// Without one the stage opens a "can't connect" dialog, so these run nightly and before a release, like live.spec.ts:
//   set E2E_LIVE=1 and the LIVEKIT_* values in .env, then run: npx playwright test screen-share
// Chromium picks a fake screen by itself (no picker), and the denial path replaces getDisplayMedia on purpose.
test.skip(
  !requireTestDb() || process.env.E2E_LIVE !== "1",
  "needs TEST_DATABASE_URL and E2E_LIVE=1",
);
const expect = baseExpect.configure({ timeout: 30_000 });

const FLAGS = [
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  "--auto-select-desktop-capture-source=Entire screen",
  "--enable-usermedia-screen-capturing",
];

test.use({
  viewport: { width: 1280, height: 900 },
  permissions: ["microphone", "camera"],
  launchOptions: { args: FLAGS },
});

async function enter(page: Page, slug: string) {
  await page.goto(`/app/rooms/${slug}`);
  await page.getByRole("button", { name: "Join room" }).click();
  await expect(page.getByRole("button", { name: "Mute microphone" })).toBeVisible();
}

/** Opens the first-time warning and chooses a source. The fake picker selects the screen by itself. */
async function present(page: Page) {
  await page.getByRole("button", { name: "Present now" }).click();
  const warn = page.getByRole("dialog", { name: "Present your screen?" });
  if (await warn.isVisible().catch(() => false)) {
    await warn.getByRole("button", { name: "Choose what to present" }).click();
  }
}

test.describe("screen sharing in a room @live", () => {
  test("warns first, shows a clear presenting state, and stops from the control", async ({
    browser,
  }) => {
    const host = await createUser("ss1", { name: "Share Host" });
    const ada = await createUser("ss2", { name: "Share Ada" });
    const room = await createRoom(host, { title: "Present room" });
    const hostCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    const adaCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(hostCtx, host);
    await signIn(adaCtx, ada);
    const h = await hostCtx.newPage();
    const a = await adaCtx.newPage();
    await enter(h, room.slug);
    await enter(a, room.slug);

    // The warning names the risk before anything is chosen.
    await a.getByRole("button", { name: "Present now" }).click();
    const warn = a.getByRole("dialog", { name: "Present your screen?" });
    await expect(warn.getByText("private messages, notifications and other tabs")).toBeVisible();
    await warn.getByRole("checkbox", { name: "Do not show this again on this device" }).check();
    await warn.getByRole("button", { name: "Choose what to present" }).click();

    // The presenter sees a clear state, not a copy of their own screen.
    await expect(a.getByText("You are presenting")).toBeVisible();
    await expect(a.getByRole("button", { name: "Stop presenting" }).first()).toBeVisible();
    await expect(a.locator('video[aria-label^="Screen shared by"]')).toHaveCount(0);

    // Everyone else gets a stage tile with the presenter's name and a Presenting status.
    const tile = h.locator('video[aria-label="Screen shared by Share Ada"]');
    await expect(tile).toBeVisible();
    await expect(h.getByText("Share Ada is presenting")).toBeVisible();
    await expect(h.getByText("Presenting", { exact: true })).toBeVisible();

    // Pin (enlarge) and put it back in the grid.
    const pin = h.getByRole("button", { name: "Back to grid" });
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await pin.click();
    await expect(h.getByRole("button", { name: "Enlarge" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Camera and microphone stay separate: the mic button is still the mic.
    await expect(a.getByRole("button", { name: "Mute microphone" })).toBeVisible();

    await a.getByRole("button", { name: "Stop presenting" }).first().click();
    await expect(a.getByText("You are presenting")).toHaveCount(0);
    await expect(tile).toHaveCount(0);

    // "Do not show again" was remembered on this device, so the next share skips the warning.
    await a.getByRole("button", { name: "Present now" }).click();
    await expect(a.getByRole("dialog", { name: "Present your screen?" })).toHaveCount(0);
    await expect(a.getByText("You are presenting")).toBeVisible();

    await hostCtx.close();
    await adaCtx.close();
  });

  test("a second person is told someone presents and can ask for the turn", async ({ browser }) => {
    const host = await createUser("ss3", { name: "Turn Host" });
    const ada = await createUser("ss4", { name: "Turn Ada" });
    const bola = await createUser("ss5", { name: "Turn Bola" });
    const room = await createRoom(host, { title: "Turn room" });
    const ctxs = await Promise.all(
      [host, ada, bola].map(async (u) => {
        const c = await browser.newContext({ permissions: ["microphone", "camera"] });
        await signIn(c, u);
        return c;
      }),
    );
    const [h, a, b] = await Promise.all(ctxs.map((c) => c.newPage()));
    if (!h || !a || !b) throw new Error("pages");
    for (const p of [h, a, b]) await enter(p, room.slug);

    await present(a);
    await expect(a.getByText("You are presenting")).toBeVisible();

    // Bola cannot replace Ada. The control says why and offers a turn.
    await b.getByRole("button", { name: "Someone is presenting" }).click();
    const busy = b.getByRole("dialog", { name: "Turn Ada is presenting" });
    await expect(busy).toBeVisible();
    await expect(busy.getByRole("button", { name: "Take over" })).toHaveCount(0);
    await busy.getByRole("button", { name: "Ask to present" }).click();
    await expect(b.getByText("Waiting for Turn Ada to answer.")).toBeVisible();

    // Ada must allow it. Declining changes nothing.
    const request = a.getByRole("dialog", { name: "Turn Bola wants to present" });
    await expect(request).toBeVisible();
    await request.getByRole("button", { name: "Not now" }).click();
    await expect(b.getByText("Turn Ada said not now.")).toBeVisible();
    await expect(a.getByText("You are presenting")).toBeVisible();

    // Ask again and allow: Ada stops, Bola is offered the turn and nobody else may start in between.
    await b.getByRole("button", { name: "Someone is presenting" }).click();
    await b.getByRole("dialog").getByRole("button", { name: "Ask to present" }).click();
    await a
      .getByRole("dialog", { name: "Turn Bola wants to present" })
      .getByRole("button", { name: "Allow" })
      .click();
    await expect(a.getByText("You are presenting")).toHaveCount(0);
    const turn = b.getByRole("dialog", { name: "Your turn to present" });
    await expect(turn).toBeVisible();
    await expect(h.getByRole("button", { name: "Present now" })).toBeVisible();
    await h.getByRole("button", { name: "Present now" }).click();
    await expect(
      h.getByText("A turn is being handed over. Try again in a few seconds."),
    ).toBeVisible();
    await turn.getByRole("button", { name: "Present now" }).click();
    await expect(b.getByText("You are presenting")).toBeVisible();

    for (const c of ctxs) await c.close();
  });

  test("the host can stop a presentation and the moderator log says so", async ({ browser }) => {
    const host = await createUser("ss6", { name: "Mod Host" });
    const ada = await createUser("ss7", { name: "Mod Ada" });
    const room = await createRoom(host, { title: "Moderated share" });
    const hostCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    const adaCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(hostCtx, host);
    await signIn(adaCtx, ada);
    const h = await hostCtx.newPage();
    const a = await adaCtx.newPage();
    await enter(h, room.slug);
    await enter(a, room.slug);
    await present(a);
    await expect(h.getByText("Mod Ada is presenting")).toBeVisible();

    await h.getByRole("button", { name: "Stop their presentation" }).click();
    await h
      .getByRole("dialog", { name: "Stop Mod Ada's presentation?" })
      .getByRole("button", { name: "Stop their presentation" })
      .click();
    await expect(a.getByText("A moderator stopped your presentation.")).toBeVisible();
    await expect(a.getByText("You are presenting")).toHaveCount(0);

    await h.getByRole("button", { name: "Moderator log" }).click();
    await expect(h.getByText("stopped the presentation of")).toBeVisible();

    await hostCtx.close();
    await adaCtx.close();
  });

  test("a presenter who reloads does not leave the room stuck", async ({ browser }) => {
    // Reconnect scenario: the presenter's tab goes away without pressing stop. LiveKit drops the track at once, and
    // the stale turn is cleared when the seat is released, so the next person can present within the heartbeat window.
    const host = await createUser("ss8", { name: "Gone Host" });
    const ada = await createUser("ss9", { name: "Gone Ada" });
    const room = await createRoom(host, { title: "Reload share" });
    const hostCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    const adaCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(hostCtx, host);
    await signIn(adaCtx, ada);
    const h = await hostCtx.newPage();
    const a = await adaCtx.newPage();
    await enter(h, room.slug);
    await enter(a, room.slug);
    await present(a);
    await expect(h.getByText("Gone Ada is presenting")).toBeVisible();

    await a.reload();
    await expect(h.locator('video[aria-label="Screen shared by Gone Ada"]')).toHaveCount(0, {
      timeout: 60_000,
    });
    await expect(h.getByRole("button", { name: "Present now" })).toBeVisible({ timeout: 60_000 });

    await hostCtx.close();
    await adaCtx.close();
  });

  test("explains a blocked picker and an unsupported browser without using the camera", async ({
    browser,
  }) => {
    const host = await createUser("ss10", { name: "Deny Host" });
    const room = await createRoom(host, { title: "Denied share" });
    const ctx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(ctx, host);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      navigator.mediaDevices.getDisplayMedia = () =>
        Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    });
    await enter(page, room.slug);
    await present(page);
    await expect(page.getByRole("alert")).toContainText("Screen sharing was blocked");
    // No silent fallback: still no presenting state, and the camera was not switched on for us.
    await expect(page.getByText("You are presenting")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();

    await page.getByRole("button", { name: "Dismiss" }).click();
    await page.evaluate(() => {
      // @ts-expect-error simulating a browser that has no screen capture at all
      delete navigator.mediaDevices.getDisplayMedia;
    });
    await page.getByRole("button", { name: "Present now" }).click();
    await expect(page.getByRole("alert")).toContainText("can not share a screen");
    await ctx.close();
  });

  test("a phone browser is told it cannot present and can still watch", async ({ browser }) => {
    const host = await createUser("ss11", { name: "Phone Host" });
    const room = await createRoom(host, { title: "Phone share" });
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      permissions: ["microphone", "camera"],
    });
    await signIn(ctx, host);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      // @ts-expect-error phone browsers have no getDisplayMedia
      delete navigator.mediaDevices.getDisplayMedia;
    });
    await enter(page, room.slug);
    await page.getByRole("button", { name: "Present now" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Most phone browsers can not share a screen",
    );
    // The control is a real 44 pixel target.
    const box = await page.getByRole("button", { name: "Present now" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await ctx.close();
  });

  test("the presenting state and the dialogs have no accessibility violations", async ({
    browser,
  }) => {
    const host = await createUser("ss12", { name: "Axe Host" });
    const room = await createRoom(host, { title: "Axe share" });
    const ctx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(ctx, host);
    const page = await ctx.newPage();
    await enter(page, room.slug);

    await page.getByRole("button", { name: "Present now" }).click();
    const warn = page.getByRole("dialog", { name: "Present your screen?" });
    await expect(warn).toBeVisible();
    const dialogScan = await new AxeBuilder({ page }).analyze();
    expect(dialogScan.violations, JSON.stringify(dialogScan.violations, null, 2)).toEqual([]);

    await warn.getByRole("button", { name: "Choose what to present" }).click();
    await expect(page.getByText("You are presenting")).toBeVisible();
    // Presenting is announced politely and the stop control has a name.
    await expect(page.getByRole("status").filter({ hasText: "You are presenting" })).toBeVisible();
    const live = await new AxeBuilder({ page }).analyze();
    expect(live.violations, JSON.stringify(live.violations, null, 2)).toEqual([]);
    await ctx.close();
  });
});

test.describe("screen sharing in a call @live", () => {
  test("either person can present, the other cannot stop it, and the call ending ends it", async ({
    browser,
  }) => {
    const ada = await createUser("sc1", { name: "Call Ada" });
    const bola = await createUser("sc2", { name: "Call Bola" });
    const conversationId = await befriend(ada, bola);
    const adaCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    const bolaCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(adaCtx, ada);
    await signIn(bolaCtx, bola);
    const a = await adaCtx.newPage();
    const b = await bolaCtx.newPage();

    await a.goto(`/app/chats/${conversationId}`);
    await a
      .getByRole("button", { name: /audio call|Call /i })
      .first()
      .click();
    await a
      .getByRole("button", { name: /^Call$|Start call/i })
      .first()
      .click();
    await b.goto("/app/chats");
    await b.getByRole("button", { name: "Answer" }).click();
    await expect(a.getByRole("button", { name: "Present now" })).toBeVisible();

    await present(a);
    await expect(a.getByText("You are presenting")).toBeVisible();
    await expect(b.locator('video[aria-label="Screen shared by Call Ada"]')).toBeVisible();
    // The other person can hide the tile for themselves but has no way to stop it.
    await expect(b.getByRole("button", { name: "Stop their presentation" })).toHaveCount(0);
    await b.getByRole("button", { name: "Hide for me" }).click();
    await expect(b.getByRole("button", { name: "Show their screen" })).toBeVisible();

    await a.getByRole("button", { name: "End call" }).click();
    await a.getByRole("button", { name: "End call" }).last().click();
    await expect(b.locator('video[aria-label="Screen shared by Call Ada"]')).toHaveCount(0);

    await adaCtx.close();
    await bolaCtx.close();
  });
});
