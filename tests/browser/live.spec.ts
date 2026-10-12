import { expect as baseExpect, test } from "@playwright/test";
import { createRoom, createUser, dbAvailable, signIn } from "./auth-helpers";

// These need a real LiveKit project behind the test server, so they run nightly and before a release:
//   set E2E_LIVE=1 and the LIVEKIT_* values in .env, then run: npx playwright test --grep @live
test.skip(!dbAvailable || process.env.E2E_LIVE !== "1", "needs TEST_DATABASE_URL and E2E_LIVE=1");
const expect = baseExpect.configure({ timeout: 30_000 });

test.use({
  viewport: { width: 1280, height: 900 },
  permissions: ["microphone", "camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

test.describe("live rooms @live", () => {
  test("a moderator mutes a member's audio, then removes them", async ({ browser }) => {
    const host = await createUser("lv1", { name: "Live Host" });
    const member = await createUser("lv2", { name: "Live Member" });
    const room = await createRoom(host, { title: "Live moderation" });

    const hostCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    const memberCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(hostCtx, host);
    await signIn(memberCtx, member);
    const h = await hostCtx.newPage();
    const m = await memberCtx.newPage();

    await h.goto(`/app/rooms/${room.slug}`);
    await h.getByRole("button", { name: "Join room" }).click();
    await m.goto(`/app/rooms/${room.slug}`);
    await m.getByRole("button", { name: "Join room" }).click();
    await expect(m.getByRole("button", { name: "Mute microphone" })).toBeVisible();

    await h.getByRole("button", { name: "People" }).click();
    await h.getByRole("button", { name: "Actions for Live Member" }).click();
    await h.getByRole("menuitem", { name: "Mute audio" }).click();
    await expect(
      m.getByRole("dialog").getByText("A moderator muted your microphone."),
    ).toBeVisible();
    await m.getByRole("button", { name: "Got it" }).click();
    await expect(m.getByRole("button", { name: "Unmute microphone" })).toBeVisible();

    await h.getByRole("button", { name: "Actions for Live Member" }).click();
    await h.getByRole("menuitem", { name: "Remove from room" }).click();
    await h.getByRole("button", { name: "Confirm" }).click();
    await expect(m.getByRole("heading", { name: "You were removed from this room" })).toBeVisible();

    await hostCtx.close();
    await memberCtx.close();
  });

  test("a member turns the camera on and the host sees the video, then it goes back to audio", async ({
    browser,
  }) => {
    const host = await createUser("lv3", { name: "Cam Host" });
    const member = await createUser("lv4", { name: "Cam Member" });
    const room = await createRoom(host, { title: "Live camera", media: "AUDIO" });

    const hostCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    const memberCtx = await browser.newContext({ permissions: ["microphone", "camera"] });
    await signIn(hostCtx, host);
    await signIn(memberCtx, member);
    const h = await hostCtx.newPage();
    const m = await memberCtx.newPage();
    for (const page of [h, m]) {
      await page.goto(`/app/rooms/${room.slug}`);
      await page.getByRole("button", { name: "Join room" }).click();
      await expect(page.getByRole("button", { name: "Turn camera on" })).toBeVisible();
    }

    await m.getByRole("button", { name: "Turn camera on" }).click();
    await expect(m.getByRole("button", { name: "Turn camera off" })).toBeVisible();
    await expect(h.locator('video[aria-label="Cam Member"]')).toBeVisible();

    await m.getByRole("button", { name: "Turn camera off" }).click();
    await expect(h.locator('video[aria-label="Cam Member"]')).toBeHidden();

    await hostCtx.close();
    await memberCtx.close();
  });
});
