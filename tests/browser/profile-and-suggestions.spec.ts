import { expect as baseExpect, test } from "@playwright/test";
import { getDb } from "@gistroom/db";
import { befriend, capturedCode, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe("profile", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("shows joined date, friend total, interests, verified status and badges, never the email", async ({
    page,
    context,
  }) => {
    const viewer = await createUser("pf1");
    const target = await createUser("pf2", {
      name: "Profile Target",
      interests: ["football", "comedy"],
    });
    const friend = await createUser("pf3");
    await befriend(target, friend);
    await getDb().badgeGrant.create({
      data: { userId: target.user.id, badge: "ROOM_HOST", ordinal: 1, evaluator: 1 },
    });
    await getDb().badgeGrant.create({
      data: { userId: target.user.id, badge: "ROOM_HOST", ordinal: 2, evaluator: 1 },
    });
    await getDb().user.update({
      where: { id: target.user.id },
      data: { badgesPublic: [{ badge: "ROOM_HOST", count: 2 }] },
    });
    await signIn(context, viewer);
    await page.goto(`/app/u/${target.user.username}`);

    await expect(page.getByRole("heading", { name: "Profile Target", level: 1 })).toBeVisible();
    await expect(page.getByText("Email verified")).toBeVisible();
    await expect(page.getByText(/^Joined /)).toBeVisible();
    await expect(page.getByText("1 friend", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Interests" })).toBeVisible();
    await expect(page.getByText("Football", { exact: true })).toBeVisible();
    const badges = page
      .getByRole("region", { name: "Badges" })
      .or(page.locator("#profile-badges").locator(".."));
    await expect(badges.getByText("Room host").first()).toBeVisible();
    await expect(badges.getByText("Earned 2 times")).toBeAttached();
    expect(await page.content()).not.toContain(target.email);
  });

  test("the owner sees their own badges and a note that private ones are only theirs", async ({
    page,
    context,
  }) => {
    const me = await createUser("pf4");
    await getDb().badgeGrant.create({
      data: { userId: me.user.id, badge: "TRUSTED_REPORTER", ordinal: 1, evaluator: 1 },
    });
    await signIn(context, me);
    await page.goto(`/app/u/${me.user.username}`);
    await expect(page.getByText("Trusted reporter")).toBeVisible();
    await expect(page.getByText("Only you see this badge.")).toBeVisible();
  });

  test("a person who hides badges shows none to visitors", async ({ page, context }) => {
    const viewer = await createUser("pf5");
    const target = await createUser("pf6");
    await getDb().badgeGrant.create({
      data: { userId: target.user.id, badge: "ROOM_HOST", ordinal: 1, evaluator: 1 },
    });
    await getDb().user.update({ where: { id: target.user.id }, data: { showBadges: false } });
    await signIn(context, viewer);
    await page.goto(`/app/u/${target.user.username}`);
    await expect(page.getByText("This person keeps their badges private.")).toBeVisible();
    await expect(page.getByText("Room host")).toHaveCount(0);
  });
});

test.describe("settings: email verification and permanent identity", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("an unverified account verifies with a code, and email and username cannot be edited", async ({
    page,
    context,
  }) => {
    const me = await createUser("pf7");
    await getDb().user.update({ where: { id: me.user.id }, data: { emailVerifiedAt: null } });
    await signIn(context, me);
    await page.goto("/app/settings/profile");

    await expect(page.getByText("Your email is not verified")).toBeVisible();
    await expect(page.getByText("Email and username are permanent")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^email/i })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Username" })).toHaveAttribute("readonly", "");

    await page.getByRole("button", { name: "Send a code" }).click();
    await expect(page.getByText(/We sent a 6 digit code/)).toBeVisible();
    const code = await capturedCode(me.email);
    await page.getByLabel("Digit 1").fill(code[0]!);
    for (let i = 1; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(code[i]!);
    await expect(page.getByText("Your email is verified", { exact: true })).toBeVisible();
    const row = await getDb().user.findUniqueOrThrow({ where: { id: me.user.id } });
    expect(row.emailVerifiedAt).not.toBeNull();
  });

  test("a wrong code shows an inline error", async ({ page, context }) => {
    const me = await createUser("pf8");
    await getDb().user.update({ where: { id: me.user.id }, data: { emailVerifiedAt: null } });
    await signIn(context, me);
    await page.goto("/app/settings/profile");
    await page.getByRole("button", { name: "Send a code" }).click();
    await expect(page.getByText(/We sent a 6 digit code/)).toBeVisible();
    for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill("0");
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("a request that names the email or username is refused by the server", async ({
    page,
    context,
  }) => {
    const me = await createUser("pf9");
    await signIn(context, me);
    await page.goto("/app/settings/profile");
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "someone_else" }),
      });
      return res.status;
    });
    expect(status).toBe(400);
    const row = await getDb().user.findUniqueOrThrow({ where: { id: me.user.id } });
    expect(row.username).toBe(me.user.username);
  });
});

test.describe("suggested friends", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("shows people with plain reasons and lets you dismiss one", async ({ page, context }) => {
    // Topics and names made for this run only, so people left behind by other specs or earlier retries never match.
    const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const topicSlugs = [`e2e-sg-${run}-a`, `e2e-sg-${run}-b`];
    for (const slug of topicSlugs) {
      await getDb().topic.create({
        data: { slug, name: `E2E suggestions ${slug}`, description: "Made by a browser spec." },
      });
    }
    try {
      const adaName = `Suggest Ada ${run}`;
      const bayoName = `Suggest Bayo ${run}`;
      const me = await createUser("sg1", { interests: topicSlugs });
      const a = await createUser("sg2", { name: adaName, interests: topicSlugs });
      await createUser("sg3", { name: bayoName, interests: [topicSlugs[0]!] });
      await signIn(context, me);
      await page.goto("/app/friends?tab=find");

      const list = page.getByRole("region", { name: "People you may know" });
      await expect(list).toBeVisible();
      const row = (name: string) => list.getByRole("listitem").filter({ hasText: name });
      await expect(row(adaName)).toHaveCount(1);
      await expect(row(adaName).getByText("2 interests in common")).toBeVisible();
      await expect(row(bayoName).getByText("1 interest in common")).toBeVisible();
      await list.getByRole("button", { name: `Not interested in ${adaName}` }).click();
      await expect(row(adaName)).toHaveCount(0);
      await expect(row(bayoName)).toHaveCount(1);
      const dismissed = await getDb().friendSuggestionDismissal.count({
        where: { userId: me.user.id, targetId: a.user.id },
      });
      expect(dismissed).toBe(1);
    } finally {
      // The e2e people go in the global cleanup. The topics are ours, so remove them here (their interests go first).
      await getDb().userInterest.deleteMany({ where: { topicSlug: { in: topicSlugs } } });
      await getDb().topic.deleteMany({ where: { slug: { in: topicSlugs } } });
    }
  });

  test("shows an empty state when there is nobody to suggest", async ({ page, context }) => {
    const me = await createUser("sg4", { interests: [] });
    await signIn(context, me);
    await page.goto("/app/friends?tab=find");
    await expect(page.getByText(/No suggestions right now/)).toBeVisible();
  });
});
