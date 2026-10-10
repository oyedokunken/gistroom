import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES, decideCookies, openStable } from "./helpers";

/** Strong backgrounds are the dark green, the black and the yellow. White and grey are quiet. */
const isStrong = (rgb: string): boolean => {
  const m = rgb.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  const [r = 255, g = 255, b = 255, a = 1] = m;
  if (a === 0) return false;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return lum < 90 || (sat > 120 && lum > 150);
};

test.describe("section backgrounds", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route}: no two neighbouring sections share a strong background`, async ({ page }) => {
      await decideCookies(page);
      await openStable(page, route);
      const colours = await page.evaluate(() =>
        [...document.querySelectorAll("main > *")]
          .filter((el) => el.getBoundingClientRect().height > 40)
          .map((el) => getComputedStyle(el).backgroundColor),
      );
      for (let i = 1; i < colours.length; i++) {
        const a = colours[i - 1]!;
        const b = colours[i]!;
        if (isStrong(a) && isStrong(b)) {
          expect(b, `${route}: section ${i} repeats ${a}`).not.toBe(a);
        }
      }
    });
  }

  test("/features: the numbers sit on black and each label shows once", async ({ page }) => {
    await decideCookies(page);
    await openStable(page, "/features");
    const section = page.locator("section", {
      has: page.getByRole("heading", { name: "The settings behind the promise" }),
    });
    const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r = 255, g = 255, b = 255] = bg.match(/\d+/g)?.map(Number) ?? [];
    expect(r + g + b, `background ${bg}`).toBeLessThan(90);
    for (const label of ["people in a room", "to edit a message", "longest voice note"]) {
      await expect(section.getByText(label, { exact: true })).toHaveCount(1);
    }
    await expect(section).toContainText("15 min");
    await expect(section).toContainText("32");
  });
});

test.describe("sell the platform, not the builder", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route}: no builder name outside the footer credit and the About maker section`, async ({
      page,
    }) => {
      await decideCookies(page);
      await openStable(page, route);
      let text = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelector("footer")?.remove();
        clone.querySelectorAll("[data-maker]").forEach((n) => n.remove());
        // A detached clone reports textContent for innerText, so inlined RSC scripts
        // would leak component props into the string. Scripts are not visible text.
        clone.querySelectorAll("script, style").forEach((n) => n.remove());
        return clone.innerText;
      });
      if (route === "/changelog") {
        // The changelog records the attribution decision (D25) verbatim.
        text = text.replace(/@?oyedokunken/gi, "");
      }
      expect(text).not.toMatch(/oyedokun|kenny/i);
      const html = await page.content();
      expect(html).not.toMatch(/"author"|"creator"/);
    });
  }

  test("the footer credit is the one public mention", async ({ page }) => {
    await decideCookies(page);
    await openStable(page, "/");
    await expect(page.locator("footer")).toContainText("Built by @oyedokunken");
  });
});
