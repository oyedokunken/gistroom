import { expect, test } from "@playwright/test";
import { befriend, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");

test.describe("floating button, wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("each place has its own button and actions", async ({ page, context }) => {
    const me = await createUser("fab1", { name: "Fab Owner" });
    const friend = await createUser("fab2", { name: "Fab Friend" });
    await befriend(me, friend);
    await signIn(context, me);

    // Chats
    await page.goto("/app/chats");
    await expect(page.locator('[data-fab="chats"]')).toBeVisible();
    await page.getByRole("button", { name: "Open Chats actions" }).click();
    await expect(page.getByRole("button", { name: "Start a new chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Find friends" })).toBeVisible();

    // Calls: audio opens a friend picker and picking one asks the server to start the call.
    await page.goto("/app/calls");
    await expect(page.locator('[data-fab="calls"]')).toBeVisible();
    await page.getByRole("button", { name: "Open Calls actions" }).click();
    await expect(page.getByRole("button", { name: "Video call" })).toBeVisible();
    await page.getByRole("button", { name: "Audio call" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Start an audio call")).toBeVisible();
    await dialog.getByRole("textbox").fill("nobody here");
    await expect(dialog.getByText("No friends match that.")).toBeVisible();
    await dialog.getByRole("textbox").fill("fab friend");
    const call = page.waitForRequest(
      (r) => r.url().endsWith("/api/calls") && r.method() === "POST",
    );
    await dialog.getByRole("button", { name: /audio call fab friend/i }).click();
    const sent = await call;
    expect(sent.postDataJSON()).toMatchObject({ media: "AUDIO" });

    // Friends: add a friend by name from a small window.
    await page.goto("/app/friends");
    await expect(page.locator('[data-fab="friends"]')).toBeVisible();
    await page.getByRole("button", { name: "Open Friends actions" }).click();
    await expect(page.getByRole("button", { name: "Find new friends" })).toBeVisible();
    await page.getByRole("button", { name: "Add a friend" }).click();
    const add = page.getByRole("dialog");
    const stranger = await createUser("fab3", { name: "Zed Stranger" });
    await add.getByRole("textbox").fill("zed stranger");
    await expect(add.getByText(`@${stranger.user.username}`)).toBeVisible();
    await expect(add.getByRole("button", { name: /add friend/i })).toBeVisible();

    // Rooms: create goes to the creation window, join takes a link or a code.
    await page.goto("/app/rooms");
    await expect(page.locator('[data-fab="rooms"]')).toBeVisible();
    await page.getByRole("button", { name: "Open Rooms actions" }).click();
    await page.getByRole("button", { name: "Join a room" }).click();
    const join = page.getByRole("dialog");
    await join.getByRole("textbox").fill("!!");
    await join.getByRole("button", { name: "Join room" }).click();
    await expect(join.getByText(/does not look like/i)).toBeVisible();
    await join.getByRole("textbox").fill("https://gistroom.example/rooms/abcdef1234?invite=tok_1");
    await join.getByRole("button", { name: "Join room" }).click();
    await expect(page).toHaveURL(/\/app\/rooms\/abcdef1234\?invite=tok_1/);
  });

  test("pages without their own button get the Discover button, and Discover has none", async ({
    page,
    context,
  }) => {
    await signIn(context, await createUser("fab4"));
    await page.goto("/app/notifications");
    const discover = page.locator('[data-fab="discover"]');
    await expect(discover).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Discover" })).toHaveAttribute(
      "href",
      "/app/discover",
    );
    await page.goto("/app/settings/profile");
    await expect(page.locator('[data-fab="discover"]')).toBeVisible();
    await page.goto("/app/discover");
    await expect(page.locator("[data-fab]")).toHaveCount(0);
  });

  test("the button changes place without leaving a stale one behind", async ({ page, context }) => {
    await signIn(context, await createUser("fab5"));
    await page.goto("/app/calls");
    await expect(page.locator('[data-fab="calls"]')).toBeVisible();
    await page.getByRole("link", { name: "Friends" }).first().click();
    await expect(page.locator('[data-fab="friends"]')).toBeVisible();
    await expect(page.locator("[data-fab]")).toHaveCount(1);
  });
});

test.describe("floating button, phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("sits above the tab bar and never covers it", async ({ page, context }) => {
    await signIn(context, await createUser("fab6"));
    await page.goto("/app/friends");
    const button = page.getByRole("button", { name: "Open Friends actions" });
    await expect(button).toBeVisible();
    const fab = await button.boundingBox();
    const tabs = await page.getByRole("navigation", { name: "App tabs" }).boundingBox();
    expect(fab && tabs).toBeTruthy();
    expect((fab?.y ?? 0) + (fab?.height ?? 0)).toBeLessThanOrEqual((tabs?.y ?? 0) + 1);
    expect(fab?.width ?? 0).toBeGreaterThanOrEqual(44);
  });
});
