import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";
import { waitForWindowRoom } from "../helpers/rate-window";

prepareTestEnv();

// The routes ask for the signed in person. Here that person is whoever the test says.
const signedIn = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth/session", () => ({
  requireOnboarded: async () => ({ user: signedIn.user, session: { id: "test_session" } }),
}));

async function load() {
  const [search, everything, peopleRoute, searchRoute, limiter, db] = await Promise.all([
    import("../../apps/web/src/server/people/search"),
    import("../../apps/web/src/server/search/service"),
    import("../../apps/web/src/app/api/people/search/route"),
    import("../../apps/web/src/app/api/search/route"),
    import("../../apps/web/src/server/rate-limit"),
    import("@gistroom/db"),
  ]);
  return { ...search, ...everything, peopleRoute, searchRoute, limiter, db: db.getDb() };
}

describe.skipIf(!requireTestDb())("people search", () => {
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

  type Person = Awaited<ReturnType<typeof person>>;
  async function person(key: string, over: Record<string, unknown> = {}) {
    return m.db.user.create({
      data: {
        email: `test_s_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: key,
        username: key.toLowerCase().replace(/[^a-z0-9]/g, ""),
        onboardedAt: new Date(),
        ...over,
      },
    });
  }
  const names = (page: { people: { name: string }[] }) => page.people.map((p) => p.name);
  async function befriend(a: Person, b: Person) {
    const [low, high] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
  }

  // ---------- Ranking ----------

  it("ranks an exact username first, then names that start with the query, then names that contain it", async () => {
    const me = await person("Viewer");
    await person("Ade Tunde"); // contains
    await person("Tunde Bakare"); // starts with
    await person("Tunde", { username: "tunde" }); // exact username and name
    await person("Funmi Okafor"); // unrelated
    const page = await m.searchPeople(me.id, "tunde", 10, null);
    expect(names(page)).toEqual(["Tunde", "Tunde Bakare", "Ade Tunde"]);
  });

  it("matches by username and by close spelling", async () => {
    const me = await person("Viewer");
    await person("Chinedu Okeke", { username: "nedu" });
    await person("Amaka Obi");
    expect(names(await m.searchPeople(me.id, "nedu", 10, null))).toEqual(["Chinedu Okeke"]);
    expect(names(await m.searchPeople(me.id, "amakka", 10, null))).toEqual(["Amaka Obi"]);
    expect(names(await m.searchPeople(me.id, "AMAKA", 10, null))).toEqual(["Amaka Obi"]);
  });

  it("never searches by email", async () => {
    const me = await person("Viewer");
    await person("Bola Ige");
    expect((await m.searchPeople(me.id, "test_s_bola@example.com", 10, null)).people).toEqual([]);
    expect((await m.searchPeople(me.id, "example.com", 10, null)).people).toEqual([]);
  });

  // ---------- Who is left out ----------

  it("leaves out yourself, blocked people either way, and accounts that should not be found", async () => {
    const me = await person("Viewer");
    await person("Seun Kunle");
    await person("Seun Blocked");
    await person("Seun Blocker");
    await person("Seun Gone", { status: "DELETED" });
    await person("Seun Suspended", { status: "SUSPENDED" });
    await person("Seun Hidden", { discoverable: false });
    await person("Seun Unfinished", { onboardedAt: null });
    await person("Seun Internal", { isInternal: true });
    const blocked = await m.db.user.findFirstOrThrow({ where: { name: "Seun Blocked" } });
    const blocker = await m.db.user.findFirstOrThrow({ where: { name: "Seun Blocker" } });
    await m.db.block.create({ data: { blockerId: me.id, blockedId: blocked.id } });
    await m.db.block.create({ data: { blockerId: blocker.id, blockedId: me.id } });

    expect(names(await m.searchPeople(me.id, "seun", 10, null))).toEqual(["Seun Kunle"]);
    // A search for yourself finds nobody.
    expect((await m.searchPeople(me.id, "viewer", 10, null)).people).toEqual([]);
    // Internal accounts are visible to other internal accounts only.
    expect(names(await m.searchPeople(me.id, "seun", 10, null, true)).sort()).toEqual([
      "Seun Internal",
      "Seun Kunle",
    ]);
  });

  it("gives each result the right action and a mutual friend count", async () => {
    const me = await person("Viewer");
    const friend = await person("Kemi Friend");
    const stranger = await person("Kemi Stranger");
    const sent = await person("Kemi Sent");
    const received = await person("Kemi Received");
    const cooling = await person("Kemi Cooling");
    const mutual = await person("Mutual Pal");
    await befriend(me, friend);
    await befriend(me, mutual);
    await befriend(stranger, mutual);
    await m.db.friendRequest.create({ data: { requesterId: me.id, addresseeId: sent.id } });
    await m.db.friendRequest.create({ data: { requesterId: received.id, addresseeId: me.id } });
    await m.db.friendRequest.create({
      data: {
        requesterId: me.id,
        addresseeId: cooling.id,
        status: "REJECTED",
        retryAfter: new Date(Date.now() + 86_400_000),
      },
    });

    const page = await m.searchPeople(me.id, "kemi", 10, null);
    const byName = Object.fromEntries(page.people.map((p) => [p.name, p]));
    expect(byName["Kemi Friend"]?.relationship).toBe("FRIENDS");
    expect(byName["Kemi Stranger"]?.relationship).toBe("NONE");
    expect(byName["Kemi Stranger"]?.mutualFriends).toBe(1);
    expect(byName["Kemi Sent"]?.relationship).toBe("REQUEST_SENT");
    expect(byName["Kemi Received"]?.relationship).toBe("REQUEST_RECEIVED");
    // A rejected request in its cooldown looks unavailable, never "rejected".
    expect(byName["Kemi Cooling"]?.relationship).toBe("UNAVAILABLE");
    expect(JSON.stringify(page)).not.toContain("@example.com");
    expect(stranger.id).toBeTruthy();
  });

  // ---------- Hostile and odd queries ----------

  it("treats percent and underscore as plain characters", async () => {
    const me = await person("Viewer");
    await person("Plain Name");
    await person("Under Score", { username: "under_score" });
    expect((await m.searchPeople(me.id, "%", 10, null)).people).toEqual([]);
    expect((await m.searchPeople(me.id, "%%", 10, null)).people).toEqual([]);
    // An underscore only matches a real underscore, not any character.
    expect(names(await m.searchPeople(me.id, "_", 10, null))).toEqual(["Under Score"]);
    expect((await m.searchPeople(me.id, "\\", 10, null)).people).toEqual([]);
  });

  it("is not moved by SQL, quotes, very long text, other scripts or emoji", async () => {
    const me = await person("Viewer");
    await person("Ọlọ́run Ẹbun", { username: "ebun" });
    const hostile = [
      `'; DROP TABLE "User"; --`,
      `" OR 1=1 --`,
      "x') OR ('1'='1",
      "a".repeat(5000),
      "\u0000null",
      "\u{1F600}\u{1F600}",
      "‮reversed",
      "%' AND similarity(name, 'a') > 0 --",
    ];
    for (const q of hostile) {
      const page = await m.searchPeople(me.id, q, 10, null);
      expect(page.people).toEqual([]);
    }
    // The table is still there and a normal search still works.
    expect(await m.db.user.count()).toBe(2);
    expect(names(await m.searchPeople(me.id, "ebun", 10, null))).toEqual(["Ọlọ́run Ẹbun"]);
  });

  it("starts from the first page when the cursor is garbage", async () => {
    const me = await person("Viewer");
    await person("Tola One");
    const first = await m.searchPeople(me.id, "tola", 10, null);
    for (const cursor of [
      "not a cursor",
      "e30",
      Buffer.from("[1,2]").toString("base64url"),
      "%%%",
    ]) {
      expect(names(await m.searchPeople(me.id, "tola", 10, cursor))).toEqual(names(first));
    }
  });

  // ---------- Paging ----------

  it("pages with an opaque cursor, without repeats or gaps", async () => {
    const me = await person("Viewer");
    for (const n of [1, 2, 3, 4, 5]) await person(`Wale ${n}`);
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Awaited<ReturnType<typeof m.searchPeople>> = await m.searchPeople(
        me.id,
        "wale",
        2,
        cursor,
      );
      seen.push(...names(page));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen.sort()).toEqual(["Wale 1", "Wale 2", "Wale 3", "Wale 4", "Wale 5"]);
  });

  // ---------- The search box ----------

  it("finds people, your own chats and your own notes together, and never someone else's notes", async () => {
    const me = await person("Viewer");
    const other = await person("Other Person");
    const tunde = await person("Tunde Chat", { username: "tundechat" });
    const conversation = await m.db.conversation.create({
      data: {
        dmKey: `${me.id}:${tunde.id}`,
        members: { create: [{ userId: me.id }, { userId: tunde.id }] },
      },
    });
    await m.db.note.create({
      data: { userId: me.id, conversationId: conversation.id, body: "tunde owes me a favour" },
    });
    await m.db.note.create({
      data: { userId: other.id, conversationId: null, body: "tunde secret" },
    });

    const results = await m.searchEverything(me as never, "tunde");
    expect(results.people.map((p) => p.name)).toEqual(["Tunde Chat"]);
    expect(results.chats.map((c) => c.conversationId)).toEqual([conversation.id]);
    expect(results.notes.map((n) => n.body)).toEqual(["tunde owes me a favour"]);
    expect(JSON.stringify(results)).not.toContain("tunde secret");

    // The leading @ is ignored, and an archived chat drops out of the chat group.
    await m.db.conversationMember.updateMany({
      where: { userId: me.id },
      data: { archivedAt: new Date() },
    });
    const archived = await m.searchEverything(me as never, "@Tunde");
    expect(archived.chats).toEqual([]);
    expect(archived.people).toHaveLength(1);
  });

  // ---------- The routes ----------

  async function get(route: "peopleRoute" | "searchRoute", query: string) {
    const url = `http://localhost:3000/api/x?${query}`;
    const res = await m[route].GET(new Request(url), { params: Promise.resolve({}) } as never);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it("refuses short, empty, over long and badly paged queries before searching", async () => {
    const me = await person("Viewer");
    signedIn.user = me;
    for (const route of ["peopleRoute", "searchRoute"] as const) {
      expect((await get(route, "q=")).status).toBe(400);
      expect((await get(route, "q=a")).status).toBe(400);
      expect((await get(route, "q=%20a%20")).status).toBe(400);
      expect((await get(route, "q=%40a")).status).toBe(400);
      expect((await get(route, `q=${"a".repeat(61)}`)).status).toBe(400);
      expect((await get(route, "")).status).toBe(400);
    }
    expect((await get("peopleRoute", "q=ab&limit=7")).status).toBe(400);
    expect((await get("peopleRoute", "q=ab&limit=abc")).status).toBe(400);
    expect((await get("peopleRoute", `q=ab&cursor=${"c".repeat(201)}`)).status).toBe(400);
  });

  it("answers a good query with people and no email addresses", async () => {
    const me = await person("Viewer");
    await person("Ngozi Eze");
    signedIn.user = me;
    const people = await get("peopleRoute", "q=ngozi");
    expect(people.status).toBe(200);
    expect(JSON.stringify(people.body)).not.toContain("@");
    expect((people.body.people as { name: string }[]).map((p) => p.name)).toEqual(["Ngozi Eze"]);
    const everything = await get("searchRoute", "q=%40ngozi");
    expect(everything.status).toBe(200);
    expect(Object.keys(everything.body).sort()).toEqual(["chats", "notes", "people", "rooms"]);
  });

  it("allows thirty searches a minute and then asks the person to wait", async () => {
    await waitForWindowRoom(60, 15_000);
    const me = await person("Viewer");
    signedIn.user = me;
    const policy = m.limiter.policies.peopleSearch;
    await m.db.rateLimit.create({
      data: {
        key: `${policy.name}:${me.id}`,
        windowStart: m.limiter.windowStart(new Date(), policy.windowSec),
        count: policy.limit,
      },
    });
    const refused = await get("peopleRoute", "q=ab");
    expect(refused.status).toBe(429);
    expect((refused.body.error as { code: string }).code).toBe("RATE_LIMITED");
    expect((await get("searchRoute", "q=ab")).status).toBe(429);
  });
});
