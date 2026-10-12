import { expect, test } from "@playwright/test";

const banner = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: /cookies/i });

test.describe("cookie banner", () => {
  test("asks once, then never comes back", async ({ page, context }) => {
    await page.goto("/");
    await expect(banner(page)).toBeVisible();

    await page.getByRole("button", { name: /essential only/i }).click();
    await expect(banner(page)).toBeHidden();

    // The cookie is host only, lasts about a year and is readable by the page.
    const cookie = (await context.cookies()).find((c) => c.name === "gr_consent");
    expect(cookie).toBeDefined();
    expect(cookie?.path).toBe("/");
    expect(cookie?.sameSite).toBe("Lax");
    const days = ((cookie?.expires ?? 0) - Date.now() / 1000) / 86_400;
    expect(days).toBeGreaterThan(360);
    expect(cookie?.httpOnly).toBe(false);

    // A reload, other routes and a brand new tab in the same browser all stay quiet.
    await page.reload();
    await expect(banner(page)).toBeHidden();
    for (const route of ["/features", "/rooms", "/about", "/login"]) {
      await page.goto(route);
      await page.waitForTimeout(500);
      await expect(banner(page)).toBeHidden();
    }
    const fresh = await context.newPage();
    await fresh.goto("/");
    await fresh.waitForTimeout(500);
    await expect(banner(fresh)).toBeHidden();
  });

  test("stays hidden after the service worker is replaced", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /accept all/i }).click();
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
    });
    await page.reload();
    await page.waitForTimeout(500);
    await expect(banner(page)).toBeHidden();
  });

  test("the footer link opens the choices again", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /essential only/i }).click();
    await page.getByRole("button", { name: /cookie settings/i }).click();
    await expect(banner(page)).toBeVisible();
  });
});
