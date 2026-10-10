import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { featuresPage, safetyPage } from "../../apps/web/src/content/marketing";

const lists = {
  "features: the small things": featuresPage.more.items,
  "safety: community guidelines": safetyPage.guidelines.items,
  "safety: the tools": safetyPage.tools.items,
};

describe("every card has a custom icon above its heading", () => {
  for (const [name, items] of Object.entries(lists)) {
    it(name, () => {
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        const icon = (item as { icon?: string }).icon;
        expect(icon, item.title).toBeTruthy();
        expect(
          existsSync(
            path.join(process.cwd(), "apps", "web", "public", "images", "icons", `${icon}.png`),
          ),
          `${icon}.png`,
        ).toBe(true);
      }
    });
  }
});
