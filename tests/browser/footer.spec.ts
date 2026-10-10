import { expect, test } from "@playwright/test";
import { WIDTHS, decideCookies, intersects, scrollToBottom, setTheme } from "./helpers";

test.describe("footer legal row", () => {
  for (const width of WIDTHS) {
    test(`tidy under the wordmark, at ${width}px @responsive`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await decideCookies(page);
      await page.goto("/");
      await scrollToBottom(page);

      const row = page.locator("[data-legal-row]");
      await expect(row).toBeVisible();
      const items = await row.locator("> *").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        }),
      );
      expect(items.length).toBeGreaterThanOrEqual(3);
      const tops = items.map((i) => i.top).sort((a, b) => a - b);
      if (width < 768) {
        // Phones may wrap onto a second row. Anything beyond that is a bug.
        const rows = tops.filter((t, i) => i === 0 || t - tops[i - 1]! > 2).length;
        expect(rows).toBeLessThanOrEqual(2);
      } else {
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
      }

      const rowBox = (await row.boundingBox())!;
      // The animation is the row of bars behind the wordmark. The legal row lines up with it exactly.
      const wordmark = page.locator("[data-wordmark] > div[aria-hidden]");
      const markBox = (await wordmark.boundingBox())!;
      expect(Math.abs(rowBox.width - markBox.width)).toBeLessThanOrEqual(1);

      // Nothing spills out of the viewport sideways.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the removed hint is gone and the copyright reads correctly", async ({ page }) => {
    await decideCookies(page);
    await page.goto("/");
    await expect(page.locator("body")).not.toContainText("Tap gistroom to play again");
    await expect(page.locator("footer")).toContainText(
      new RegExp(`Copyright ${new Date().getUTCFullYear()}`),
    );
    await expect(page.locator("footer")).not.toContainText("Made in Nigeria");
    await expect(page.locator("footer")).toContainText("Cookie settings");
  });

  test("the theme control and the page position never overlap each other or the legal row", async ({
    page,
  }) => {
    test.setTimeout(120_000); // four viewports, each with a full load and scroll
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await decideCookies(page);
      await page.goto("/");
      await scrollToBottom(page);
      const theme = await page
        .getByRole("button", { name: "Theme", exact: true })
        .first()
        .boundingBox();
      const wave = await page
        .getByRole("slider", { name: /position/i })
        .first()
        .boundingBox();
      const legal = await page.locator("[data-legal-row]").boundingBox();
      expect(theme, `theme at ${width}`).not.toBeNull();
      if (wave) expect(intersects(theme!, wave)).toBe(false);
      if (legal) expect(intersects(theme!, legal)).toBe(false);
      if (wave && legal) expect(intersects(wave, legal)).toBe(false);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`the surface behind the wordmark stays the ${theme} surface before, during and after`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await setTheme(page, theme);
      await decideCookies(page);
      await page.goto("/");
      const read = () =>
        page.evaluate(() => {
          const mark = document.querySelector("[data-wordmark]");
          const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : "");
          return {
            mark: bg(mark ?? null),
            footer: bg(document.querySelector("footer")),
            body: bg(document.body),
          };
        });
      const before = await read();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await page.waitForTimeout(250);
      const during = await read();
      await scrollToBottom(page);
      await page.waitForTimeout(1200);
      const after = await read();
      expect(during).toEqual(before);
      expect(after).toEqual(before);
    });
  }
});
