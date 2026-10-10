import { expect, test } from "@playwright/test";
import { decideCookies, openStable } from "./helpers";

test.describe("mobile More sheet", () => {
  for (const width of [360, 390]) {
    test(`every item has an icon and a 44px hit area at ${width}px @responsive`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await decideCookies(page);
      await openStable(page, "/");
      const more = page.getByRole("button", { name: /^More/ });
      await expect(more).toBeVisible();
      await page.waitForTimeout(800); // the dock slides in
      await more.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const links = dialog.getByRole("link");
      const count = await links.count();
      expect(count).toBeGreaterThanOrEqual(4);
      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const box = (await link.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(await link.locator("svg, img").count()).toBeGreaterThan(0);
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    });
  }
});

test.describe("rooms never show a technical error", () => {
  const banned = /could not load|error|failed|try again/i;

  for (const [name, status, body] of [
    ["empty", 200, JSON.stringify({ rooms: [], failed: false })],
    ["failing", 500, JSON.stringify({ error: { code: "SERVER" } })],
  ] as const) {
    test(`/rooms with a ${name} room list shows the friendly state`, async ({ page }) => {
      await decideCookies(page);
      await page.route("**/api/public/rooms**", (route) =>
        route.fulfill({ status, contentType: "application/json", body }),
      );
      await page.goto("/rooms");
      await page.getByRole("button", { name: "football" }).click();
      await page.getByRole("button", { name: "football" }).click();
      const main = page.locator("main");
      await expect(main).toContainText("No rooms live right now", { timeout: 15_000 });
      await expect(main).toContainText("Start one and let people join the gist.");
      await expect(main.getByRole("link", { name: "Start a room" }).first()).toBeVisible();
      expect(await main.innerText()).not.toMatch(banned);
    });
  }

  test("the server render is friendly when the database is down", async ({ page }) => {
    await decideCookies(page);
    await page.goto("/rooms");
    const main = page.locator("main");
    await expect(main).toContainText("No rooms live right now");
    expect(await main.innerText()).not.toMatch(/could not load|failed|try again/i);
  });
});
