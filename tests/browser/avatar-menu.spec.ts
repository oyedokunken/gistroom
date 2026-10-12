import { expect, test } from "@playwright/test";
import { createUser, dbAvailable, signIn } from "./auth-helpers";

test.skip(!dbAvailable, "needs TEST_DATABASE_URL");

test.describe("avatar menu on a wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("opens a dropdown with settings, notifications and log out, and logout asks first", async ({
    page,
    context,
  }) => {
    const me = await createUser("menu");
    await signIn(context, me);
    await page.goto("/app/discover");

    await page.getByRole("button", { name: /open the menu for/i }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /settings/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /notifications/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /log out/i })).toBeVisible();

    // Cancel keeps you signed in.
    await menu.getByRole("menuitem", { name: /log out/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /cancel|stay|no/i }).click();
    await expect(page).toHaveURL(/\/app\/discover/);

    // Confirm signs out and lands on the login page.
    await page.getByRole("button", { name: /open the menu for/i }).click();
    await page.getByRole("menuitem", { name: /log out/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^sign out$/i })
      .click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("settings entry goes to settings", async ({ page, context }) => {
    await signIn(context, await createUser("menu2"));
    await page.goto("/app/discover");
    await page.getByRole("button", { name: /open the menu for/i }).click();
    await page.getByRole("menuitem", { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/app\/settings/);
  });
});

test.describe("avatar menu on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("opens as a bottom sheet", async ({ page, context }) => {
    await signIn(context, await createUser("menu3"));
    await page.goto("/app/discover");
    await page.getByRole("button", { name: /open the menu for/i }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("link", { name: /settings/i })).toBeVisible();
    await expect(sheet.getByRole("link", { name: /notifications/i })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /log out/i })).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThan(200);
  });
});
