import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { createUser, signIn, type E2eUser } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
test.use({ viewport: { width: 1280, height: 900 } });
const expect = baseExpect.configure({ timeout: 20_000 });

async function seed(me: E2eUser, count: number) {
  const db = getDb();
  for (let i = 0; i < count; i += 1) {
    await db.notification.create({
      data: {
        userId: me.user.id,
        type: "CALL_MISSED",
        payload: { fromName: i % 3 === 0 ? `Funmi ${i}` : `Dayo ${i}` },
        createdAt: new Date(Date.now() - i * 60_000),
      },
    });
  }
}

test("searches, loads the next page, comes back and shows an empty result", async ({
  page,
  context,
}) => {
  const me = await createUser("nsearch");
  await seed(me, 45);
  await signIn(context, me);
  await page.goto("/app/notifications");
  const list = page.locator("[data-notifications-list]");
  const rows = list.locator("button[data-nid]");

  // Next page: 20 rows, then Show more adds the rest of the first kind.
  await expect(rows).toHaveCount(20);
  await list.getByRole("button", { name: "Show more" }).click();
  await expect(rows).toHaveCount(40);

  // A single character is not searched.
  const box = page.getByLabel("Search notifications");
  await box.fill("f");
  await expect(page.getByText("Type at least 2 characters to search.")).toBeVisible();

  // Search is debounced into the address and filters on the server.
  await box.fill("funmi");
  await expect(page).toHaveURL(/q=funmi/);
  await expect(rows).toHaveCount(15);
  await expect(list.getByText("Funmi 0")).toBeVisible();
  await expect(list.getByText("Dayo 1")).toHaveCount(0);

  // Opening one keeps the search, and back returns to the same list.
  await rows.first().click();
  await expect(page).toHaveURL(/n=/);
  await expect(page).toHaveURL(/q=funmi/);
  await page.goBack();
  await expect(page).not.toHaveURL(/n=/);
  await expect(box).toHaveValue("funmi");
  await expect(rows).toHaveCount(15);

  // No results is a state with words, and clearing brings the list back.
  await box.fill("zzzz");
  await expect(list.getByText(/Nothing found for "zzzz"/)).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(rows.first()).toBeVisible();
  await expect(page).not.toHaveURL(/q=/);
});
