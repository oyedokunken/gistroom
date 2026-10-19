import { expect as baseExpect, test } from "@playwright/test";
import { createRoom, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

test.describe("discover", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("shows live and upcoming rooms with who is in them, and hides private rooms it should", async ({
    page,
    context,
  }) => {
    const tag = Date.now().toString(36);
    const me = await createUser("dis1", { interests: ["football", "comedy", "gaming"] });
    const host = await createUser("dis2", { name: "Host Hauwa" });
    const guest = await createUser("dis3", { name: "Guest Gbenga" });
    await createRoom(host, {
      title: `Match talk ${tag}`,
      topic: "football",
      media: "VIDEO",
      language: "PIDGIN",
      description: "Who plays tonight and why it matters",
      members: [{ person: guest, state: "JOINED" }],
    });
    await createRoom(host, {
      title: `Standup night ${tag}`,
      topic: "comedy",
      status: "SCHEDULED",
      scheduledInMinutes: 90,
    });
    await createRoom(host, {
      title: `Invited only ${tag}`,
      topic: "gaming",
      visibility: "PRIVATE",
      members: [{ person: me, state: "INVITED" }],
    });
    await createRoom(host, { title: `Secret ${tag}`, visibility: "PRIVATE" });

    await signIn(context, me);
    await page.goto("/app/discover");

    // The four sections, in order.
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    const order = ["Live now", "Starting soon", "For you", "Browse topics"].map((h) =>
      headings.indexOf(h),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    const card = page.getByRole("link", { name: new RegExp(`Match talk ${tag}`) }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Football");
    await expect(card).toContainText("Pidgin");
    await expect(card).toContainText("Video");
    await expect(card).toContainText("Hosted by Host Hauwa");
    await expect(card).toContainText("2 people");
    await expect(card).toContainText("Who plays tonight and why it matters");
    await expect(card).toContainText("Join");

    await expect(
      page.getByRole("link", { name: new RegExp(`Standup night ${tag}`) }).first(),
    ).toContainText("Starts");
    const invited = page.getByRole("link", { name: new RegExp(`Invited only ${tag}`) }).first();
    await expect(invited).toBeVisible();
    await expect(invited).toContainText("You are invited");
    await expect(page.getByText(`Secret ${tag}`)).toHaveCount(0);

    // No decorative pictures in the cards and filters. Only the topic marquee at the very end has icons.
    const sources = await page
      .locator("main img")
      .evaluateAll((els) =>
        els
          .filter((e) => !e.closest("#discover-topics, [aria-labelledby=discover-topics]"))
          .map((e) => (e as HTMLImageElement).src),
      );
    expect(sources.filter((s) => /\/images\/(scenes|icons)\//.test(s))).toEqual([]);
    await expect(page.getByRole("heading", { name: "Browse by topic" })).toBeVisible();
  });

  test("filters by topic, language and title, and sorts", async ({ page, context }) => {
    const tag = Date.now().toString(36);
    // Interests that match no room here, so the For you row stays out of the way of the counts below.
    const me = await createUser("dis4", {
      interests: ["education", "parenting", "history-and-heritage"],
    });
    const host = await createUser("dis5");
    const guests = [await createUser("dis6"), await createUser("dis7")];
    await createRoom(host, { title: `Alpha ${tag}`, topic: "football", language: "ENGLISH" });
    await createRoom(host, {
      title: `Bravo ${tag}`,
      topic: "comedy",
      language: "YORUBA",
      members: guests.map((g) => ({ person: g, state: "JOINED" as const })),
    });
    await signIn(context, me);
    await page.goto("/app/discover");

    const live = page.getByRole("link", { name: new RegExp(`(Alpha|Bravo) ${tag}`) });
    await expect(live).toHaveCount(2);
    // Most active first: Bravo has three people, Alpha one.
    await expect(live.first()).toContainText(`Bravo ${tag}`);

    await page.getByRole("button", { name: "Football", exact: true }).first().click();
    await expect(live).toHaveCount(1);
    await expect(live.first()).toContainText(`Alpha ${tag}`);
    await page.getByRole("button", { name: "All topics" }).click();
    await expect(live).toHaveCount(2);

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Yoruba" }).click();
    await expect(live).toHaveCount(1);
    await expect(live.first()).toContainText(`Bravo ${tag}`);

    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Any language" }).click();
    await page.getByLabel("Search rooms by title").fill(`alpha ${tag}`);
    await expect(live).toHaveCount(1);
    await expect(live.first()).toContainText(`Alpha ${tag}`);

    await page.getByLabel("Search rooms by title").fill(`nothing matches ${tag}`);
    await expect(page.getByRole("heading", { name: "No rooms match that" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a room" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(live).toHaveCount(2);
  });

  test("works on a phone without sideways scrolling", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const me = await createUser("dis8");
    await createRoom(await createUser("dis9"), {
      title: "A room with a rather long title that has to wrap properly",
    });
    await signIn(context, me);
    await page.goto("/app/discover");
    await expect(page.getByRole("heading", { name: "Live now" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    // The topic chips scroll by themselves, not the page.
    const chips = page.getByRole("list", { name: "Topics" });
    expect(await chips.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });
});
