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

      // The shell can be re-rendered while the page settles, so each measurement waits for a box that stays.
      const widthOf = async (route: string, variant: string) => {
        const shell = page.locator(`[data-page-shell="${variant}"]`).first();
        let width = 0;
        await expect
          .poll(
            async () => {
              width = (await shell.boundingBox())?.width ?? 0;
              return width > 0;
            },
            { message: route },
          )
          .toBe(true);
        return width;
      };

      for (const route of FULL) {
        await page.goto(route);
        await expect
          .poll(async () => Math.abs((await widthOf(route, "full")) - Math.min(1400, width)), {
            message: route,
          })
          .toBeLessThanOrEqual(2);
      }

      const narrowWidths: number[] = [];
      for (const route of NARROW) {
        await page.goto(route);
        const measured = await widthOf(route, "narrow");
        expect(measured, route).toBeLessThanOrEqual(721);
        narrowWidths.push(Math.round(measured));
      }
      // Every settings tab is the same width.
      expect(new Set(narrowWidths).size, narrowWidths.join(",")).toBe(1);
    });
  });
}
