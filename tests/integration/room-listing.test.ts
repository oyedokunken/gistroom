import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();
if (testDbEnabled) {
  process.env.LIVEKIT_URL = "http://nothing-listens.invalid";
  process.env.LIVEKIT_API_KEY = "test_key";
  process.env.LIVEKIT_API_SECRET = "s".repeat(40);
  process.env.REALTIME_URL = "http://nothing-listens.invalid";
}

async function load() {
  const [listing, discover, db] = await Promise.all([
    import("../../apps/web/src/server/rooms/listing"),
    import("../../apps/web/src/server/discover/service"),
    import("@gistroom/db"),
  ]);
  return { ...listing, discoverFeed: discover.discoverFeed, db: db.getDb() };
}

const MIN = 60_000;

describe.skipIf(!requireTestDb())("room lists", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await resetTestDb();
  });

  async function person(key: string) {
    return m.db.user.create({
      data: {
        email: `test_rl_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_rl_${key}`,
        onboardedAt: new Date(),
      },
    });
  }
  async function topic(slug: string) {
    return m.db.topic.upsert({
      where: { slug },
      update: {},
      create: { slug, name: slug, description: slug },
    });
  }
  async function room(
    host: { id: string },
    over: {
      slug: string;
      title?: string;
      status?: "LIVE" | "SCHEDULED" | "ENDED";
      visibility?: "PUBLIC" | "PRIVATE";
      topicSlug?: string;
      language?: "ENGLISH" | "YORUBA" | "PIDGIN";
      inMin?: number;
    },
  ) {
    const t = over.topicSlug ? await topic(over.topicSlug) : null;
    const status = over.status ?? "LIVE";
    return m.db.room.create({
      data: {
        slug: over.slug,
        hostId: host.id,
        title: over.title ?? over.slug,
        topicId: t?.id ?? null,
        language: over.language ?? "ENGLISH",
        visibility: over.visibility ?? "PUBLIC",
        status,
        livekitRoom: `lk_${over.slug}`,
        startedAt: status === "LIVE" ? new Date(Date.now() - 5 * MIN) : null,
        scheduledFor:
          status === "SCHEDULED" ? new Date(Date.now() + (over.inMin ?? 120) * MIN) : null,
      },
    });
  }
  async function join(
    roomId: string,
    userId: string,
    state: "JOINED" | "INVITED",
    registered = false,
  ) {
    await m.db.roomMember.create({
      data: {
        roomId,
        userId,
        state,
        joinedAt: state === "JOINED" ? new Date() : null,
        registeredAt: registered ? new Date() : null,
      },
    });
  }

  it("lists live rooms first and upcoming rooms by start time, and never drops a live room for upcoming ones", async () => {
    const host = await person("h1");
    for (let i = 0; i < 3; i++) {
      await room(host, { slug: `soon${i}`, status: "SCHEDULED", inMin: 60 + i * 10 });
    }
    await room(host, { slug: "livea", status: "LIVE" });
    const cards = await m.fetchRoomCards(null, {});
    expect(cards.map((c) => c.slug)).toEqual(["livea", "soon0", "soon1", "soon2"]);
    expect(cards[0]?.status).toBe("LIVE");
    expect(cards.slice(1).every((c) => c.status === "SCHEDULED")).toBe(true);
  });

  it("shows the same public rooms, in the same order, on the public list and on Discover", async () => {
    const host = await person("h2");
    const viewer = await person("v2");
    const stranger = await person("s2");
    await room(host, { slug: "pub-live", topicSlug: "football" });
    await room(host, { slug: "pub-soon", status: "SCHEDULED", topicSlug: "football", inMin: 40 });
    await room(host, { slug: "pub-later", status: "SCHEDULED", topicSlug: "music", inMin: 400 });
    const hidden = await room(stranger, { slug: "private-x", visibility: "PRIVATE" });
    await room(host, { slug: "ended-x", status: "ENDED" });

    for (const filters of [
      {},
      { topic: "football" },
      { language: "ENGLISH" as const },
      { q: "pub" },
    ]) {
      const publicCards = await m.fetchRoomCards(null, filters);
      const discover = await m.discoverFeed(
        await m.db.user.findUniqueOrThrow({ where: { id: viewer.id } }),
        {
          sort: "active",
          topic: (filters as { topic?: string }).topic,
          language: (filters as { language?: string }).language,
          q: (filters as { q?: string }).q,
        },
      );
      expect([...discover.live, ...discover.soon].map((c) => c.slug)).toEqual(
        publicCards.map((c) => c.slug),
      );
      expect(publicCards.map((c) => c.slug)).not.toContain("private-x");
      expect(publicCards.map((c) => c.slug)).not.toContain("ended-x");
    }
    void hidden;
  });

  it("adds a private room only for the people invited to it", async () => {
    const host = await person("h3");
    const invited = await person("i3");
    const other = await person("o3");
    const priv = await room(host, { slug: "secret", visibility: "PRIVATE" });
    await join(priv.id, invited.id, "INVITED");
    expect((await m.fetchRoomCards(invited, {})).map((c) => c.slug)).toEqual(["secret"]);
    expect(await m.fetchRoomCards(other, {})).toEqual([]);
    expect(await m.fetchRoomCards(null, {})).toEqual([]);
  });

  it("counts people in a live room and people attending an upcoming one from the database", async () => {
    const host = await person("h4");
    const a = await person("a4");
    const b = await person("b4");
    const c = await person("c4");
    const live = await room(host, { slug: "count-live" });
    await join(live.id, a.id, "JOINED");
    await join(live.id, b.id, "JOINED");
    const soon = await room(host, { slug: "count-soon", status: "SCHEDULED" });
    await join(soon.id, a.id, "INVITED", true);
    await join(soon.id, b.id, "INVITED", true);
    await join(soon.id, c.id, "INVITED", false);
    const cards = await m.fetchRoomCards(null, {});
    const bySlug = new Map(cards.map((x) => [x.slug, x]));
    expect(bySlug.get("count-live")?.listeners).toBe(2);
    expect(bySlug.get("count-soon")).toMatchObject({ listeners: 0, attending: 2 });
  });

  it("recommends related rooms by topic first and never itself, ended, or private rooms the viewer is not in", async () => {
    const host = await person("h5");
    const viewer = await person("v5");
    const base = await room(host, { slug: "base", topicSlug: "football", language: "ENGLISH" });
    await room(host, { slug: "same-topic", topicSlug: "football", language: "YORUBA" });
    await room(host, { slug: "same-lang", topicSlug: "music", language: "ENGLISH" });
    await room(host, { slug: "other", topicSlug: "tech", language: "PIDGIN" });
    await room(host, { slug: "gone", status: "ENDED", topicSlug: "football" });
    await room(host, { slug: "private-football", visibility: "PRIVATE", topicSlug: "football" });
    const related = await m.relatedRooms(viewer, base.slug);
    const slugs = related.map((r) => r.slug);
    expect(slugs[0]).toBe("same-topic");
    expect(slugs).toContain("same-lang");
    expect(slugs).not.toContain("base");
    expect(slugs).not.toContain("gone");
    expect(slugs).not.toContain("private-football");
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("answers an empty list for a private room the viewer is not in, and for a room that does not exist", async () => {
    const host = await person("h6");
    const viewer = await person("v6");
    await room(host, { slug: "pub6", topicSlug: "football" });
    await room(host, { slug: "priv6", visibility: "PRIVATE", topicSlug: "football" });
    expect(await m.relatedRooms(viewer, "priv6")).toEqual([]);
    expect(await m.relatedRooms(viewer, "missing")).toEqual([]);
    expect(await m.relatedRooms(null, "priv6")).toEqual([]);
  });

  it("returns an empty list when nothing else is on", async () => {
    const host = await person("h7");
    const only = await room(host, { slug: "only7" });
    expect(await m.relatedRooms(null, only.slug)).toEqual([]);
  });
});
