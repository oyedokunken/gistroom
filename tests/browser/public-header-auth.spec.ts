import { expect as baseExpect, test } from "@playwright/test";
import { createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";
import { decideCookies } from "./helpers";

// The sign in state comes from a call to the server after the page loads, and several tests share one remote database.
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe("public header when signed out", () => {
  test("says Enter Gistroom and shows no avatar", async ({ page }) => {
    await decideCookies(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Enter Gistroom" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /open the menu for/i })).toHaveCount(0);
  });
});

test.describe("public header when signed in", () => {
  test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");

  test("desktop dock says Open Gistroom and shows the avatar menu", async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(context, await createUser("pub1"));
    await page.goto("/");
    const open = page.getByRole("link", { name: "Open Gistroom" }).first();
    await expect(open).toBeVisible();
    await expect(page.getByRole("link", { name: "Enter Gistroom" })).toHaveCount(0);
    const menu = page.getByRole("button", { name: /open the menu for/i });
    await expect(menu).toBeVisible();
    // The button keeps its width, so nothing shifts when the label changes.
    expect((await open.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(136);
    await menu.click();
    await expect(page.getByRole("menuitem", { name: /log out/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /open gistroom/i })).toBeVisible();
  });

  test("the page links follow the sign in state too", async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(context, await createUser("pub2"));
    await page.goto("/features");
    await expect(page.getByRole("link", { name: "Open Gistroom" }).last()).toHaveAttribute(
      "href",
      "/app/discover",
    );
  });

  test("phone dock centre button opens the app and the More sheet shows the account", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await signIn(context, await createUser("pub3"));
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Open Gistroom" }).first()).toHaveAttribute(
      "href",
      "/app/discover",
    );
    await page.getByRole("button", { name: /more/i }).click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: "Open Gistroom" }),
    ).toBeVisible();
  });

  test("signing out brings the sign up button back", async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(context, await createUser("pub4"));
    await page.goto("/app/discover");
    await page.getByRole("button", { name: /open the menu for/i }).click();
    await page.getByRole("menuitem", { name: /log out/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^sign out$/i })
      .click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Enter Gistroom" }).first()).toBeVisible();
  });
});
