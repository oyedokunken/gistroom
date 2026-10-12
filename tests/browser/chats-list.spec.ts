import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { befriend, createUser, dbAvailable, signIn } from "./auth-helpers";

test.skip(!dbAvailable, "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

const YELLOW = "rgb(255, 194, 14)";
const INK = "rgb(11, 11, 12)";

test.describe("chats list", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the empty pane has one picture and one short line, and no buttons", async ({
    page,
    context,
  }) => {
    await signIn(context, await createUser("cl1"));
    await page.goto("/app/chats");
    const pane = page.locator("section", { hasText: "No chat open" });
    await expect(pane.getByRole("heading", { name: "No chat open" })).toBeVisible();
    await expect(pane.getByText("Pick a chat, or start a new one.")).toBeVisible();
    for (const label of ["Start a new chat", "Find friends", "Host a room", "Take the tour"]) {
      await expect(pane.getByRole("link", { name: label })).toHaveCount(0);
      await expect(pane.getByRole("button", { name: label })).toHaveCount(0);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`the Archived bar is visible, counts, and turns yellow on hover and focus (${theme})`, async ({
      page,
      context,
    }) => {
      await page.addInitScript((t) => window.localStorage.setItem("gr_theme", t), theme);
      const me = await createUser(`cl2${theme}`);
      const friend = await createUser(`cl3${theme}`, { name: "Archived Friend" });
      const conversationId = await befriend(me, friend);
      await getDb().conversationMember.updateMany({
        where: { conversationId, userId: me.user.id },
        data: { archivedAt: new Date() },
      });
      await signIn(context, me);
      await page.goto("/app/chats");

      const bar = page.locator("[data-archived-bar]");
      await expect(bar).toBeVisible();
      await expect(bar).toContainText("Archived");
      await expect(bar.locator("span.tabular")).toHaveText("1");
      const box = await bar.boundingBox();
      const list = await page.locator("section[aria-label='Chats']").boundingBox();
      expect(Math.abs((box?.width ?? 0) - (list?.width ?? 0))).toBeLessThanOrEqual(2);

      const colours = () =>
        bar.evaluate((el) => {
          const icon = el.querySelector("svg");
          return {
            bg: getComputedStyle(el).backgroundColor,
            text: getComputedStyle(el).color,
            icon: icon ? getComputedStyle(icon).color : "",
          };
        });

      await bar.hover();
      await expect.poll(async () => (await colours()).bg).toBe(YELLOW);
      let c = await colours();
      expect(c.text).toBe(INK);
      expect(c.icon).toBe(INK);

      await page.mouse.move(5, 5);
      await expect.poll(async () => (await colours()).bg).not.toBe(YELLOW);

      await bar.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect.poll(async () => (await colours()).bg).toBe(YELLOW);
      c = await colours();
      expect(c.text).toBe(INK);
      expect(c.icon).toBe(INK);

      // It opens the archived chats.
      await bar.click();
      await expect(page.getByRole("link", { name: /Archived Friend/ })).toBeVisible();
    });
  }
});
