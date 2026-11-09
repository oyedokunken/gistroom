import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { befriend, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe("forwarding a message", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("picks a friend, sends, and shows the Forwarded label in the other chat", async ({
    page,
    context,
  }) => {
    const me = await createUser("fw1", { name: "Forward Me" });
    const source = await createUser("fw2", { name: "Source Friend" });
    const target = await createUser("fw3", { name: "Target Friend" });
    const sourceChat = await befriend(me, source);
    const targetChat = await befriend(me, target);
    await getDb().message.create({
      data: {
        conversationId: sourceChat,
        senderId: source.user.id,
        clientId: "fw-orig-0001",
        type: "TEXT",
        body: "Match starts at eight",
      },
    });
    await signIn(context, me);
    await page.goto(`/app/chats/${sourceChat}`);

    await page.getByText("Match starts at eight").click();
    await page.getByRole("menuitem", { name: "Forward", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Forward to" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Search your friends" }).fill("Target");
    await expect(dialog.getByRole("checkbox", { name: "Choose Source Friend" })).toHaveCount(0);
    await dialog.getByRole("checkbox", { name: "Choose Target Friend" }).click();
    await dialog.getByRole("button", { name: "Forward to 1 person" }).click();
    await expect(page.getByText("Sent to Target Friend.")).toBeVisible();

    await page.getByRole("button", { name: "Got it" }).first().click();
    await page.goto(`/app/chats/${targetChat}`);
    await expect(page.getByText("Match starts at eight")).toBeVisible();
    await expect(page.getByText("Forwarded", { exact: true })).toBeVisible();
  });

  test("selecting several messages shows a count and a Forward action", async ({
    page,
    context,
  }) => {
    const me = await createUser("fw4");
    const friend = await createUser("fw5", { name: "Select Friend" });
    const chatId = await befriend(me, friend);
    for (const n of [1, 2]) {
      await getDb().message.create({
        data: {
          conversationId: chatId,
          senderId: friend.user.id,
          clientId: `fw-sel-000${n}`,
          type: "TEXT",
          body: `Selectable ${n}`,
        },
      });
    }
    await signIn(context, me);
    await page.goto(`/app/chats/${chatId}`);
    await page.getByText("Selectable 1").click();
    await page.getByRole("menuitem", { name: "Select" }).click();
    await expect(page.getByText("1 selected")).toBeVisible();
    await page.getByRole("checkbox", { name: "Select message" }).nth(1).click();
    await expect(page.getByText("2 selected")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  });
});
