import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { befriend, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe("notifications", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("opens an item in a modal, marks it read, and keeps Activity apart from All", async ({
    page,
    context,
  }) => {
    const me = await createUser("nt1");
    const friend = await createUser("nt2", { name: "Ada Okafor" });
    const db = getDb();
    const request = await db.friendRequest.create({
      data: { requesterId: friend.user.id, addresseeId: me.user.id },
    });
    await db.notification.create({
      data: {
        userId: me.user.id,
        type: "FRIEND_REQUEST_RECEIVED",
        payload: {
          requestId: request.id,
          fromName: "Ada Okafor",
          fromUsername: friend.user.username,
        },
      },
    });
    await db.notification.create({
      data: {
        userId: me.user.id,
        type: "ACTIVITY",
        readAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        payload: { kind: "room-started", text: 'You started "Match talk".' },
      },
    });

    await signIn(context, me);
    // On a phone the detail is still a modal.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/app/notifications");
    await expect(page.getByRole("radio", { name: "Activity" })).toBeVisible();
    await expect(page.getByText("New friend request")).toBeVisible();
    await expect(page.getByText('You started "Match talk".')).toHaveCount(0);

    await page.getByRole("button", { name: /New friend request/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Accept" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Decline" })).toBeVisible();
    // The sender is shown, with a way to see their profile.
    await expect(dialog.getByRole("link", { name: "View profile" })).toBeVisible();
    await dialog.getByRole("button", { name: "Accept" }).click();
    // After accepting it says so and offers Message, here and when the modal is opened again.
    await expect(dialog.getByText("You are now friends")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Message" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: /New friend request/ }).click();
    await expect(page.getByRole("dialog").getByText("You are now friends")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Accept", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    const row = await db.friendRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe("ACCEPTED");

    await page.getByRole("radio", { name: "Activity" }).click();
    await expect(page.getByText('You started "Match talk".')).toBeVisible();
    await expect(page.getByText("These disappear after 7 days.", { exact: false })).toBeVisible();
  });

  test("selects several, marks them unread, and asks before deleting with the count", async ({
    page,
    context,
  }) => {
    const me = await createUser("nt3");
    const db = getDb();
    for (let i = 0; i < 3; i += 1) {
      await db.notification.create({
        data: {
          userId: me.user.id,
          type: "SYSTEM",
          readAt: new Date(),
          payload: { n: i },
        },
      });
    }
    await signIn(context, me);
    await page.goto("/app/notifications");
    await expect(page.getByRole("listitem").first()).toBeVisible();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByLabel("Select all").check();
    await expect(page.getByText("3 selected")).toBeVisible();
    await page.getByRole("button", { name: "Mark as unread" }).click();
    await expect
      .poll(() => db.notification.count({ where: { userId: me.user.id, readAt: null } }))
      .toBe(3);

    await expect(page.getByRole("listitem").first()).toBeVisible();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByLabel("Select all").check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Delete 3 notifications?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).last().click();
    await expect.poll(() => db.notification.count({ where: { userId: me.user.id } })).toBe(0);
  });

  test("undo on an Activity line brings back an archived chat", async ({ page, context }) => {
    const me = await createUser("nt4");
    const friend = await createUser("nt5");
    const conversationId = await befriend(me, friend);
    const db = getDb();
    await db.conversationMember.updateMany({
      where: { conversationId, userId: me.user.id },
      data: { archivedAt: new Date() },
    });
    await db.notification.create({
      data: {
        userId: me.user.id,
        type: "ACTIVITY",
        readAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        payload: {
          kind: "archived",
          text: "You archived your chat.",
          undo: { action: "unarchive", conversationId },
        },
      },
    });
    await signIn(context, me);
    await page.goto("/app/notifications");
    await page.getByRole("radio", { name: "Activity" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect
      .poll(
        async () =>
          (
            await db.conversationMember.findFirstOrThrow({
              where: { conversationId, userId: me.user.id },
            })
          ).archivedAt,
      )
      .toBeNull();
  });
});
