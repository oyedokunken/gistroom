import { expect, test } from "@playwright/test";
import { decideCookies } from "./helpers";

test.describe("Google sign in is built but switched off", () => {
  for (const path of ["/login", "/signup"]) {
    test(`${path}: the button stays and opens a modal with the icon above the title`, async ({
      page,
    }) => {
      await decideCookies(page);
      await page.goto(path);
      await page
        .getByRole("button", { name: /continue with google|google/i })
        .first()
        .click();
      const modal = page.locator("[data-modal]");
      await expect(modal).toBeVisible();
      await expect(modal).toContainText("Google sign in is not available yet");
      await expect(modal).toContainText("Use your email and password for now.");

      const icon = await page.locator("[data-modal-icon]").boundingBox();
      const title = await page.locator("[data-modal-title]").boundingBox();
      expect(icon, "icon box").not.toBeNull();
      expect(title, "title box").not.toBeNull();
      // The icon sits above the title: its bottom edge is at or above the title's top edge.
      expect(icon!.y + icon!.height).toBeLessThanOrEqual(title!.y + 1);
      // And both are centred on the same vertical axis.
      expect(Math.abs(icon!.x + icon!.width / 2 - (title!.x + title!.width / 2))).toBeLessThan(4);

      await page.getByRole("button", { name: "Got it" }).click();
      await expect(modal).toBeHidden();
    });
  }

  test("Escape closes the modal and the title labels the dialog", async ({ page }) => {
    await decideCookies(page);
    await page.goto("/login");
    await page
      .getByRole("button", { name: /google/i })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(/Google sign in is not available yet/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the OAuth routes refuse to start while the flag is off", async ({ request }) => {
    const start = await request.get("/api/auth/google", { maxRedirects: 0 });
    expect(start.status()).toBe(404);
    const back = await request.get("/api/auth/google/callback?code=x&state=y", {
      maxRedirects: 0,
    });
    expect(back.status()).toBe(404);
  });
});
