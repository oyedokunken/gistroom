import { expect as baseExpect, test } from "@playwright/test";
import { createRoom, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe("copy room link", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("copies the public room link and says so inline, without a toast", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const host = await createUser("lnk1");
    const room = await createRoom(host, { title: "Link room", topic: "football" });
    await page.goto(`/rooms/${room.slug}`);
    await page.getByRole("button", { name: "Copy room link" }).click();
    await expect(page.getByText("Room link copied")).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe(`http://localhost:3217/rooms/${room.slug}`);
    await expect(page.getByRole("heading", { name: "Other rooms you might like" })).toBeVisible();
  });

  test("shows the link to copy by hand when the browser blocks the clipboard", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
      });
    });
    const host = await createUser("lnk2");
    const room = await createRoom(host, { title: "Manual copy room" });
    await page.goto(`/rooms/${room.slug}`);
    await page.getByRole("button", { name: "Copy room link" }).click();
    const dialog = page.getByRole("dialog", { name: "Copy this link yourself" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Room link" })).toHaveValue(
      `http://localhost:3217/rooms/${room.slug}`,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("a private room says who can enter, and its public link shows nothing about it", async ({
    page,
    context,
  }) => {
    const tag = Date.now().toString(36);
    const host = await createUser("lnk3");
    const invited = await createUser("lnk4");
    const room = await createRoom(host, {
      title: `Private plans ${tag}`,
      visibility: "PRIVATE",
      members: [{ person: invited, state: "INVITED" }],
    });
    await signIn(context, invited);
    await page.goto("/app/discover");
    await page.getByRole("button", { name: `View details: Private plans ${tag}` }).click();
    const panel = page.getByRole("complementary", { name: "Room details" });
    await expect(panel.getByText(/Only invited people/)).toBeVisible();

    const stranger = await context.browser()!.newContext();
    const other = await stranger.newPage();
    await other.goto(`/rooms/${room.slug}`);
    await expect(other.getByText(`Private plans ${tag}`)).toHaveCount(0);
    await expect(other.getByText(/not invited/i)).toBeVisible();
    await stranger.close();
  });
});
