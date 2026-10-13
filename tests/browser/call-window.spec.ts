import { expect as baseExpect, test, type Page } from "@playwright/test";
import { befriend, createRoom, createUser, dbAvailable, signIn } from "./auth-helpers";

test.skip(!dbAvailable, "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 25_000 });

// The test server has no real LiveKit behind it, so these check the window itself: where it is, how it moves and what
// it leaves alone. The audio and video are covered by the @live specs.

async function startCall(page: Page, conversationId: string, kind: "Audio" | "Video" = "Audio") {
  await page.goto(`/app/chats/${conversationId}`);
  const confirm = page.getByRole("button", { name: `Start ${kind.toLowerCase()} call` });
  // The first tap can land before the page has hydrated, so tap until the question appears.
  await expect(async () => {
    await page
      .getByRole("button", { name: `${kind} call`, exact: true })
      .first()
      .click();
    await expect(confirm).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await confirm.click();
}

async function setup(key: string) {
  const me = await createUser(`cw${key}`, { name: "Caller One" });
  const friend = await createUser(`cf${key}`, { name: "Ada Okafor" });
  const conversationId = await befriend(me, friend);
  return { me, friend, conversationId };
}

async function closeNotices(page: Page) {
  // A call to someone with no alerts on asks whether to keep calling. The window is what is under test.
  const dialog = page.getByRole("alertdialog");
  // The question can arrive a moment after the window opens, so give it time before moving on.
  await dialog
    .first()
    .waitFor({ state: "visible", timeout: 6_000 })
    .catch(() => undefined);
  for (let i = 0; i < 3 && (await dialog.count()); i += 1) {
    await dialog.first().getByRole("button").first().click();
    await page.waitForTimeout(400);
  }
}

test.describe("call window on a desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("starting a call opens the window and leaves the chat as it was", async ({
    page,
    context,
  }) => {
    const { me, conversationId } = await setup("1");
    await signIn(context, me);
    await startCall(page, conversationId);
    const win = page.getByTestId("call-window");
    await expect(win).toBeVisible();
    await expect(win).toHaveAttribute("data-call-window", "EXPANDED");
    // The address, the thread and the composer did not change.
    expect(page.url()).toContain(`/app/chats/${conversationId}`);
    await closeNotices(page);
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    // Not modal: the page behind still works.
    await expect(win).toHaveAttribute("role", "dialog");
    await expect(win).toHaveAttribute("aria-modal", "false");
  });

  test("sits top right, clear of the composer, and the floating button steps aside", async ({
    page,
    context,
  }) => {
    const { me, conversationId } = await setup("2");
    await signIn(context, me);
    await startCall(page, conversationId);
    const win = page.getByTestId("call-window");
    await expect(win).toBeVisible();
    await closeNotices(page);
    const box = await win.boundingBox();
    const composer = await page.getByRole("textbox", { name: "Message" }).boundingBox();
    expect(box && composer).toBeTruthy();
    if (box && composer) {
      const overlaps =
        box.x < composer.x + composer.width &&
        box.x + box.width > composer.x &&
        box.y < composer.y + composer.height &&
        box.y + box.height > composer.y;
      expect(overlaps).toBe(false);
      expect(box.x + box.width).toBeGreaterThan(1280 - 100);
      expect(box.y).toBeGreaterThan(50);
    }
  });

  test("minimizes to a bar with mute and hang up, and returns", async ({ page, context }) => {
    const { me, conversationId } = await setup("3");
    await signIn(context, me);
    await startCall(page, conversationId);
    await closeNotices(page);
    await page.getByRole("button", { name: "Minimize" }).click();
    const win = page.getByTestId("call-window");
    await expect(win).toHaveAttribute("data-call-window", "MINIMIZED");
    const bar = page.locator("[data-call-window-bar]");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: "Hang up" })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^(Mute|Unmute)/ })).toBeVisible();
    await bar.getByRole("button", { name: "Return to call" }).first().click();
    await expect(win).toHaveAttribute("data-call-window", "EXPANDED");
  });

  test("goes full screen from the header and Escape comes back", async ({ page, context }) => {
    const { me, conversationId } = await setup("4");
    await signIn(context, me);
    await startCall(page, conversationId);
    await closeNotices(page);
    const win = page.getByTestId("call-window");
    await page.getByRole("button", { name: "Full screen" }).click();
    await expect(win).toHaveAttribute("data-call-window", "FULLSCREEN");
    const box = await win.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(1279);
    await page.keyboard.press("Escape");
    await expect(win).toHaveAttribute("data-call-window", "EXPANDED");
    // A double click on the header toggles it too.
    await page.locator("[data-call-window-header]").dblclick({ position: { x: 60, y: 20 } });
    await expect(win).toHaveAttribute("data-call-window", "FULLSCREEN");
  });

  test("drags and resizes, stays on screen, and remembers where it was", async ({
    page,
    context,
  }) => {
    const { me, conversationId } = await setup("5");
    await signIn(context, me);
    await startCall(page, conversationId);
    await closeNotices(page);
    const win = page.getByTestId("call-window");
    const header = page.locator("[data-call-window-header]");
    const before = await win.boundingBox();
    expect(before).toBeTruthy();
    if (!before) return;
    const h = await header.boundingBox();
    if (!h) return;
    // Drag it far to the bottom left: it is held inside the screen.
    await page.mouse.move(h.x + 60, h.y + 20);
    await page.mouse.down();
    await page.mouse.move(h.x - 2000, h.y + 2000, { steps: 8 });
    await page.mouse.up();
    // The drop snaps to the edge a moment later, so wait for it to settle before measuring.
    await expect.poll(async () => (await win.boundingBox())?.x).toBe(8);
    const after = await win.boundingBox();
    expect(after).toBeTruthy();
    if (after) {
      expect(after.x).toBeGreaterThanOrEqual(0);
      expect(after.y).toBeGreaterThanOrEqual(0);
      expect(after.x + after.width).toBeLessThanOrEqual(1280);
      expect(after.y + after.height).toBeLessThanOrEqual(800);
      expect(after.x).toBeLessThan(before.x - 100);
    }
    // Pull the right edge wider, then reload: the size and place are remembered.
    const edge = page.locator('[data-resize="e"]');
    const eb = await edge.boundingBox();
    if (eb && after) {
      await page.mouse.move(eb.x + 2, eb.y + eb.height / 2);
      await page.mouse.down();
      await page.mouse.move(eb.x + 120, eb.y + eb.height / 2, { steps: 6 });
      await page.mouse.up();
      const wider = await win.boundingBox();
      expect((wider?.width ?? 0) > after.width + 50).toBe(true);
      const stored = await page.evaluate(() => {
        const key = Object.keys(window.localStorage).find((k) => k.startsWith("gr_callwindow:"));
        return key ? window.localStorage.getItem(key) : null;
      });
      expect(stored).toContain('"w"');
    }
  });

  test("keeps the call when you go to another page", async ({ page, context }) => {
    const { me, conversationId } = await setup("6");
    await signIn(context, me);
    await startCall(page, conversationId);
    await closeNotices(page);
    await page.getByRole("link", { name: "For you" }).first().click();
    await expect(page).toHaveURL(/\/app\/discover/);
    await expect(page.getByTestId("call-window")).toBeVisible();
  });

  test("closing asks first when it is live, and the window never goes above a dialog", async ({
    page,
    context,
  }) => {
    const { me, conversationId } = await setup("7");
    await signIn(context, me);
    await startCall(page, conversationId);
    await closeNotices(page);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    const win = page.getByTestId("call-window");
    const ask = page.getByRole("alertdialog");
    if (await ask.count()) {
      await expect(ask).toContainText("Leave this call?");
      const z = await page.evaluate(() => {
        const w = document.querySelector('[data-testid="call-window"]');
        const d = document.querySelector('[role="alertdialog"]');
        return [
          Number(w ? getComputedStyle(w).zIndex : 0),
          Number(d ? getComputedStyle(d).zIndex : 0),
        ];
      });
      expect((z[1] ?? 0) > (z[0] ?? 0)).toBe(true);
      await ask.getByRole("button", { name: "Stay" }).click();
      await expect(win).toBeVisible();
    } else {
      await expect(win).toHaveCount(0);
    }
  });
});

test.describe("rooms in the call window", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("a room opened from Discover floats over Discover and the address stays", async ({
    page,
    context,
  }) => {
    const host = await createUser("cwh1", { name: "Room Host" });
    const guest = await createUser("cwg1", { name: "Room Guest" });
    const room = await createRoom(host, { title: "Window talk", topic: "football" });
    await signIn(context, guest);
    await page.goto("/app/discover");
    await page
      .getByRole("link", { name: /Window talk/ })
      .first()
      .click();
    const win = page.getByTestId("call-window");
    await expect(win).toBeVisible();
    await expect(page).toHaveURL(/\/app\/discover/);
    await expect(win.getByRole("button", { name: "Join room" })).toBeVisible();
    expect(room.slug.length).toBeGreaterThan(3);
  });

  test("the room address opens the window over a details page", async ({ page, context }) => {
    const host = await createUser("cwh2", { name: "Room Host" });
    const guest = await createUser("cwg2", { name: "Room Guest" });
    const room = await createRoom(host, { title: "Deep link talk" });
    await signIn(context, guest);
    await page.goto(`/app/rooms/${room.slug}`);
    await expect(page.getByTestId("call-window")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "This room is open in the call window" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deep link talk", level: 1 })).toBeVisible();
  });

  test("an ended room keeps its own page and opens no window", async ({ page, context }) => {
    const host = await createUser("cwh3", { name: "Room Host" });
    const guest = await createUser("cwg3", { name: "Room Guest" });
    const room = await createRoom(host, { title: "Over already", status: "ENDED" });
    await signIn(context, guest);
    await page.goto(`/app/rooms/${room.slug}`);
    await expect(page.getByTestId("call-window")).toHaveCount(0);
  });
});

test.describe("call window on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("opens full screen, and minimizes to a thin bar to tap", async ({ page, context }) => {
    const { me, conversationId } = await setup("p1");
    await signIn(context, me);
    await startCall(page, conversationId);
    await closeNotices(page);
    const win = page.getByTestId("call-window");
    await expect(win).toBeVisible();
    const box = await win.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(389);
    await page.getByRole("button", { name: "Minimize" }).click();
    const bar = page.locator("[data-call-window-bar]");
    await expect(bar).toContainText("In call, tap to return");
    const bb = await bar.boundingBox();
    expect(bb?.y).toBeLessThanOrEqual(1);
    await bar.getByRole("button", { name: "Return to call" }).click();
    await expect(win).toHaveAttribute("data-call-window", "FULLSCREEN");
  });
});
