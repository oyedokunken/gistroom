import { expect, test } from "@playwright/test";
import { createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
// Twelve signed in page loads in a row are slow when the machine is busy.
test.setTimeout(120_000);

const FULL = ["/app/discover", "/app/rooms", "/app/calls", "/app/friends", "/app/notifications"];
const NARROW = [
  "/app/settings/profile",
  "/app/settings/privacy",
  "/app/settings/notifications",
  "/app/settings/devices",
  "/app/settings/appearance",
  "/app/settings/install",
  "/app/settings/data",
];

for (const width of [1280, 1440]) {
  test.describe(`page widths at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("full pages use the whole content width and narrow pages one column", async ({
      page,
      context,
    }) => {
      const person = await createUser("widths");
      await signIn(context, person);

      for (const route of FULL) {
        await page.goto(route);
        const box = await page.locator('[data-page-shell="full"]').first().boundingBox();
        expect(box, route).not.toBeNull();
        expect(Math.abs((box?.width ?? 0) - Math.min(1400, width)), route).toBeLessThanOrEqual(2);
      }

      const narrowWidths: number[] = [];
      for (const route of NARROW) {
        await page.goto(route);
        const box = await page.locator('[data-page-shell="narrow"]').first().boundingBox();
        expect(box, route).not.toBeNull();
        expect(box?.width ?? 0, route).toBeLessThanOrEqual(721);
        narrowWidths.push(Math.round(box?.width ?? 0));
      }
      // Every settings tab is the same width.
      expect(new Set(narrowWidths).size, narrowWidths.join(",")).toBe(1);
    });
  });
}
