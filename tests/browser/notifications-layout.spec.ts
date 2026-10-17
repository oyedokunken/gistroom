import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { createUser, signIn, type E2eUser } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

async function seed(me: E2eUser, count: number) {
  const db = getDb();
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = await db.notification.create({
      data: {
        userId: me.user.id,
        type: "SYSTEM",
        payload: { title: `Note ${i}`, body: `Body ${i}` },
        createdAt: new Date(Date.now() - i * 60_000),
      },
    });
    ids.push(row.id);
  }
  return ids;
}

for (const width of [1280, 1440]) {
  test.describe(`at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("shows two columns, no auto selection, and selects by click, keys and the address", async ({
      page,
      context,
    }) => {
      const me = await createUser(`nl${width}`);
      const ids = await seed(me, 3);
      await signIn(context, me);
      await page.goto("/app/notifications");
      const list = page.locator("[data-notifications-list]");
      const detail = page.locator("[data-notification-detail]");
      await expect(list).toBeVisible();
      await expect(detail).toBeVisible();
      const [a, b] = [await list.boundingBox(), await detail.boundingBox()];
      expect(a && b && b.x > a.x + a.width - 1).toBeTruthy();
      // Nothing is opened for you.
      await expect(detail.getByText("Pick a notification to see the details")).toBeVisible();
      expect(page.url()).not.toContain("n=");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      const rows = list.locator("button[data-nid]");
      await rows.first().click();
      await expect(page).toHaveURL(new RegExp(`n=${ids[0]}`));
      await expect(detail.getByRole("heading", { level: 2 })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // Arrow keys move the selection through the list.
      await rows.first().focus();
      await page.keyboard.press("ArrowDown");
      await expect(page).toHaveURL(new RegExp(`n=${ids[1]}`));

      // A refresh keeps the selection.
      await page.reload();
      await expect(page).toHaveURL(new RegExp(`n=${ids[1]}`));
      await expect(detail.getByRole("heading", { level: 2 })).toBeVisible();
    });

    test("marks one read after a second, and a deleted one says it is gone", async ({
      page,
      context,
    }) => {
      const me = await createUser(`nm${width}`);
      const ids = await seed(me, 2);
      const db = getDb();
      await signIn(context, me);
      await page.goto(`/app/notifications?n=${ids[0]}`);
      await expect
        .poll(
          async () =>
            (await db.notification.findUniqueOrThrow({ where: { id: ids[0] as string } })).readAt,
        )
        .not.toBeNull();
      expect(
        (await db.notification.findUniqueOrThrow({ where: { id: ids[1] as string } })).readAt,
      ).toBeNull();

      await db.notification.delete({ where: { id: ids[0] as string } });
      await page.reload();
      await expect(
        page.locator("[data-notification-detail]").getByText("This is no longer available"),
      ).toBeVisible();
    });

    test("deleting the selected one picks another, and Accept turns into Message", async ({
      page,
      context,
    }) => {
      const me = await createUser(`nd${width}`);
      const friend = await createUser(`nf${width}`, { name: "Ada Okafor" });
      const db = getDb();
      const request = await db.friendRequest.create({
        data: { requesterId: friend.user.id, addresseeId: me.user.id },
      });
      const first = await db.notification.create({
        data: {
          userId: me.user.id,
          type: "FRIEND_REQUEST_RECEIVED",
          payload: { requestId: request.id, fromName: "Ada Okafor" },
        },
      });
      await seed(me, 2);
      await signIn(context, me);
      await page.goto(`/app/notifications?n=${first.id}`);
      const detail = page.locator("[data-notification-detail]");
      await expect(detail.getByRole("link", { name: "View profile" })).toBeVisible();
      await detail.getByRole("button", { name: "Accept" }).click();
      await expect(detail.getByText("You are now friends")).toBeVisible();
      await expect(detail.getByRole("link", { name: "Message" })).toBeVisible();

      // Bulk select the open one and delete it, behind a confirmation.
      await page.getByRole("button", { name: "Select", exact: true }).click();
      await page.getByLabel(/^Select New friend request/).check();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByRole("heading", { name: /Delete \d notification/ })).toBeVisible();
      await page.getByRole("button", { name: "Delete", exact: true }).last().click();
      await expect.poll(() => db.notification.count({ where: { id: first.id } })).toBe(0);
      await expect(page).not.toHaveURL(new RegExp(first.id));
      await expect(page).toHaveURL(/n=/);
    });
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("keeps one column and opens the detail in a modal", async ({ page, context }) => {
    const me = await createUser("nlphone");
    await seed(me, 2);
    await signIn(context, me);
    await page.goto("/app/notifications");
    await expect(page.locator("[data-notification-detail]")).toHaveCount(0);
    await page.locator("[data-notifications-list] button[data-nid]").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/n=/);
  });
});
