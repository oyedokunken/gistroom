import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { befriend, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe("chat thread on a phone", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("the back button sits before the avatar, keeps the draft and returns to the list", async ({
    page,
    context,
  }) => {
    const me = await createUser("back1");
    const friend = await createUser("back2", { name: "Back Friend" });
    const conversationId = await befriend(me, friend);
    await signIn(context, me);
    await page.goto(`/app/chats/${conversationId}`);

    const back = page.getByRole("link", { name: "Back to chats" });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const avatarBox = await page.getByRole("link", { name: /profile: Back Friend/ }).boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((avatarBox?.x ?? 0) + 1);

    await page.getByRole("textbox", { name: "Message" }).fill("half a thought");
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/app\/chats\/?$/);

    await page.goto(`/app/chats/${conversationId}`);
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("half a thought");
  });
});

test.describe("voice note in a chat", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("stays readable on hover and focus and passes the accessibility scan", async ({
    page,
    context,
  }) => {
    const me = await createUser("vn1");
    const friend = await createUser("vn2", { name: "Voice Friend" });
    const conversationId = await befriend(me, friend);
    for (const [senderId, clientId] of [
      [me.user.id, "vn-mine"],
      [friend.user.id, "vn-theirs"],
    ] as const) {
      await getDb().message.create({
        data: {
          conversationId,
          senderId,
          clientId,
          type: "VOICE",
          attachments: {
            create: {
              storagePath: `dm/${conversationId}/${senderId}/${clientId}.webm`,
              mime: "audio/webm",
              sizeBytes: 4000,
              durationMs: 12_000,
              waveform: Array.from({ length: 64 }, (_, i) => 20 + ((i * 7) % 60)),
            },
          },
        },
      });
    }
    await signIn(context, me);
    await page.goto(`/app/chats/${conversationId}`);

    const plays = page.getByRole("button", { name: "Play voice note" });
    await expect(plays).toHaveCount(2);
    for (const play of [plays.nth(0), plays.nth(1)]) {
      await play.hover();
      const colours = await play.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, fg: s.color };
      });
      expect(colours.bg).not.toBe(colours.fg);
    }
    const speed = page.getByRole("button", { name: /Playback speed/ }).first();
    await speed.focus();
    await expect(speed).toBeFocused();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.id === "color-contrast")).toEqual([]);
  });
});
