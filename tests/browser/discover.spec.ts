import { expect as baseExpect, test, type Page } from "@playwright/test";
import { createRoom, createUser, signIn } from "./auth-helpers";
import { requireTestDb } from "../helpers/require-test-db";

test.skip(!requireTestDb(), "needs TEST_DATABASE_URL");
const expect = baseExpect.configure({ timeout: 20_000 });

/** A room card on a list: the list item that holds the title. */
const cardOf = (page: Page, title: string | RegExp) =>
  page.getByRole("listitem").filter({ hasText: title }).first();

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

    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    const order = ["Live now", "Starting soon", "For you", "Browse topics"].map((h) =>
      headings.indexOf(h),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    const card = cardOf(page, `Match talk ${tag}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Football");
    await expect(card).toContainText("Pidgin");
    await expect(card).toContainText("Video");
    await expect(card).toContainText("Hosted by Host Hauwa");
    await expect(card).toContainText("2 in room");
    await expect(card).toContainText("Who plays tonight and why it matters");
    await expect(card.getByRole("link", { name: "Join room" })).toBeVisible();

    const upcoming = cardOf(page, `Standup night ${tag}`);
    await expect(upcoming).toContainText("Starts");
    await expect(upcoming).toContainText("0 attending");
    await expect(upcoming).toContainText("Starts in:");
    await expect(upcoming.getByRole("link", { name: "Join room" })).toHaveCount(0);

    const invited = cardOf(page, `Invited only ${tag}`);
    await expect(invited).toBeVisible();
    await expect(invited).toContainText("You are invited");
    await expect(page.getByText(`Secret ${tag}`)).toHaveCount(0);

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

  test("a host sees Start room once the room is ready, and an attendee sees a countdown", async ({
    page,
    context,
  }) => {
    const tag = Date.now().toString(36);
    const host = await createUser("dis10", { name: "Ready Host" });
    const attendee = await createUser("dis11");
    await createRoom(host, {
      title: `Ready soon ${tag}`,
      status: "SCHEDULED",
      scheduledInMinutes: 5,
    });
    await createRoom(host, {
      title: `Far away ${tag}`,
      status: "SCHEDULED",
      scheduledInMinutes: 26 * 60,
    });

    await signIn(context, host);
    await page.goto("/app/discover");
    await expect(
      cardOf(page, `Ready soon ${tag}`).getByRole("link", { name: "Start room" }),
    ).toBeVisible();
    await expect(
      cardOf(page, `Far away ${tag}`).getByRole("link", { name: "Start room" }),
    ).toHaveCount(0);
    await expect(cardOf(page, `Far away ${tag}`)).toContainText(/Starts in: 1 day/);

    await context.clearCookies();
    await signIn(context, attendee);
    await page.goto("/app/discover");
    await expect(
      cardOf(page, `Ready soon ${tag}`).getByRole("link", { name: "Start room" }),
    ).toHaveCount(0);
    await expect(cardOf(page, `Ready soon ${tag}`)).toContainText("Starts in:");
  });

  test("choosing a card opens its details beside the list, with related rooms and a copy link", async ({
    page,
    context,
  }) => {
    const tag = Date.now().toString(36);
    const me = await createUser("dis12");
    const host = await createUser("dis13", { name: "Detail Host" });
    await createRoom(host, {
      title: `Detail room ${tag}`,
      topic: "football",
      description: "About the match",
    });
    await createRoom(host, { title: `Related room ${tag}`, topic: "football" });
    await signIn(context, me);
    await page.goto("/app/discover");

    await page.getByRole("button", { name: `View details: Detail room ${tag}` }).click();
    const panel = page.getByRole("complementary", { name: "Room details" });
    await expect(panel.getByRole("heading", { name: `Detail room ${tag}` })).toBeVisible();
    await expect(panel).toContainText("Hosted by Detail Host");
    await expect(panel.getByRole("heading", { name: "Other rooms you might like" })).toBeVisible();
    await expect(
      panel.getByRole("link", { name: new RegExp(`Related room ${tag}`) }),
    ).toBeVisible();
    await expect(panel.getByRole("button", { name: "Copy room link" })).toBeVisible();
    await expect(panel.getByText("Anyone with this link can open the room page.")).toBeVisible();
  });

  test("filters by topic and language in the filter dialog, and by title and sort", async ({
    page,
    context,
  }) => {
    const tag = Date.now().toString(36);
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

    const live = page.getByRole("listitem").filter({ hasText: new RegExp(`(Alpha|Bravo) ${tag}`) });
    await expect(live).toHaveCount(2);
    await expect(live.first()).toContainText(`Bravo ${tag}`);

    const open = () => page.getByRole("button", { name: /^Filters/ }).click();
    const dialog = page.getByRole("dialog", { name: "Filter rooms" });

    await open();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox", { name: "Topic" }).click();
    await page.getByRole("option", { name: "Football" }).click();
    // Nothing changes until Apply.
    await expect(live).toHaveCount(2);
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(live).toHaveCount(1);
    await expect(live.first()).toContainText(`Alpha ${tag}`);
    await expect(page.getByRole("button", { name: "Remove filter: Football" })).toBeVisible();

    await page.getByRole("button", { name: "Remove filter: Football" }).click();
    await expect(live).toHaveCount(2);

    await open();
    await dialog.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("option", { name: "Yoruba" }).click();
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(live).toHaveCount(1);
    await expect(live.first()).toContainText(`Bravo ${tag}`);

    // Reset clears the dialog, Escape closes without applying.
    await open();
    await dialog.getByRole("button", { name: "Reset" }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(live).toHaveCount(1);
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(live).toHaveCount(2);

    await page.getByLabel("Search rooms by title").fill(`alpha ${tag}`);
    await expect(live).toHaveCount(1);
    await page.getByLabel("Search rooms by title").fill(`nothing matches ${tag}`);
    await expect(page.getByRole("heading", { name: "No rooms match that" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a room" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(live).toHaveCount(2);
  });

  test("works on a phone without sideways scrolling, and opens details in a sheet with a way back", async ({
    page,
    context,
  }) => {
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
    await page
      .getByRole("button", { name: /View details: A room with a rather long title/ })
      .click();
    const sheet = page.getByRole("dialog", { name: "Room details" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Back to rooms" }).click();
    await expect(sheet).toHaveCount(0);
  });
});

test.describe("public rooms page", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("lists live rooms first, then upcoming ones, for a signed out visitor with honest actions", async ({
    page,
  }) => {
    const tag = Date.now().toString(36);
    const host = await createUser("pub1", { name: "Public Host" });
    await createRoom(host, { title: `Live public ${tag}`, topic: "football" });
    await createRoom(host, {
      title: `Upcoming public ${tag}`,
      topic: "football",
      status: "SCHEDULED",
      scheduledInMinutes: 26 * 60,
    });
    await createRoom(host, { title: `Hidden private ${tag}`, visibility: "PRIVATE" });
    await page.goto(`/rooms?q=${tag}`);

    const live = cardOf(page, `Live public ${tag}`);
    const soon = cardOf(page, `Upcoming public ${tag}`);
    await expect(live).toBeVisible();
    await expect(soon).toBeVisible();
    await expect(live).toContainText("Live");
    await expect(live).toContainText("in room");
    await expect(live.getByRole("link", { name: "Sign in to join" })).toBeVisible();
    await expect(soon).toContainText("Upcoming");
    await expect(soon).toContainText("0 attending");
    await expect(soon).toContainText(/Starts in: 1 day/);
    await expect(soon.getByRole("link", { name: /Join room|Start room/ })).toHaveCount(0);
    await expect(page.getByText(`Hidden private ${tag}`)).toHaveCount(0);

    const order = await page
      .getByRole("listitem")
      .filter({ hasText: new RegExp(`(Live|Upcoming) public ${tag}`) })
      .allTextContents();
    expect(order[0]).toContain(`Live public ${tag}`);
  });
});
