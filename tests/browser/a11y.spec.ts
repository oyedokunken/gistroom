import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES, decideCookies } from "./helpers";

test.describe("public pages pass axe @a11y", () => {
  test.setTimeout(180_000);
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no serious or critical violations`, async ({ page }) => {
      await decideCookies(page);
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page }).analyze();
      const violations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      ).toEqual([]);
    });
  }
});
