import { expect as baseExpect, test } from "@playwright/test";
import { createRoom, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 25_000 });

test.describe("connection states", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("shows an offline bar, turns network actions off, then says Back online", async ({
    page,
    context,
  }) => {
    await signIn(context, await createUser("conn1"));
    await page.goto("/app/rooms");
    const start = page.getByRole("button", { name: "Start a room" });
    await expect(start).toBeEnabled();

    await context.setOffline(true);
    // The change has to hold for three seconds before anything reacts.
    const bar = page.locator('[data-connection-bar="OFFLINE"]');
    await expect(bar).toContainText("You're offline. Messages will send when you're back.");
    await expect(start).toBeDisabled();
    await expect(start).toHaveAttribute("title", "Needs a connection");

    await context.setOffline(false);
    await expect(page.locator('[data-connection-bar="RECOVERED"]')).toContainText("Back online");
    // The bar for the line itself goes away. (A quiet note about the chat connection can remain when no chat server runs.)
    await expect(page.locator('[data-connection-bar="RECOVERED"]')).toHaveCount(0);
    await expect(page.locator('[data-connection-bar="OFFLINE"]')).toHaveCount(0);
    await expect(start).toBeEnabled();
  });

  test("does not react to a blip shorter than three seconds", async ({ page, context }) => {
    await signIn(context, await createUser("conn2"));
    await page.goto("/app/rooms");
    await expect(page.getByRole("button", { name: "Start a room" })).toBeEnabled();
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    await context.setOffline(false);
    await page.waitForTimeout(4000);
    await expect(page.locator('[data-connection-bar="OFFLINE"]')).toHaveCount(0);
    await expect(page.locator('[data-connection-bar="RECOVERED"]')).toHaveCount(0);
  });

  test("the offline page says what to do and has a Try again button", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await expect(page.getByText("Check your connection, then try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("join dialogs", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("a private room that you are not invited to says so in a dialog with a way forward", async ({
    page,
    context,
  }) => {
    const host = await createUser("jd1");
    const stranger = await createUser("jd2");
    const room = await createRoom(host, { title: "Closed door", visibility: "PRIVATE" });
    await signIn(context, stranger);
    await page.goto(`/app/rooms/${room.slug}`);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("You are not invited");
    await expect(dialog.getByRole("button", { name: "Browse live rooms" })).toBeVisible();
    // Nothing about the room leaks.
    await expect(page.getByText("Closed door")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("a revoked link says it was turned off", async ({ page, context }) => {
    const host = await createUser("jd3");
    const guest = await createUser("jd4");
    const room = await createRoom(host, { title: "Link room", visibility: "PRIVATE" });
    await signIn(context, guest);
    await page.goto(`/app/rooms/${room.slug}?invite=not-a-real-token`);
    await expect(page.getByRole("alertdialog")).toContainText(/turned off|expired/);
  });
});

test.describe("a browser built into another app", () => {
  test.use({
    viewport: { width: 390, height: 800 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile [FBAN/FBIOS;FBAV/450.0]",
  });

  test("is told to open the link in the real browser before trying to join", async ({
    page,
    context,
  }) => {
    const host = await createUser("jd5");
    const guest = await createUser("jd6");
    const room = await createRoom(host, { title: "Open air" });
    await signIn(context, guest);
    await page.goto(`/app/rooms/${room.slug}`);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Open in your browser to join");
    await expect(dialog.getByRole("button", { name: "Copy link" })).toBeVisible();
  });
});
