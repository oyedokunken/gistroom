import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();

const WEB_ORIGIN = "http://localhost:3000";

// The routes ask for the signed in person. Here that person is whoever the test says.
const signedIn = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth/session", async () => {
  const { unauthorized } = await import("@/server/http");
  const ctx = async () => {
    if (!signedIn.user) throw unauthorized();
    return { user: signedIn.user, session: { id: "test_session" } };
  };
  return { requireUser: ctx, requireOnboarded: ctx };
});
// A welcome email on a first save would go through the mail pipeline. It is not what these tests are about.
vi.mock("@/server/mail/notify-email", () => ({ emailWelcome: vi.fn(async () => undefined) }));

async function load() {
  const [interests, profile, serialize, meRoute, interestsRoute, userRoute, db, mail] =
    await Promise.all([
      import("../../apps/web/src/server/interests/service"),
      import("../../apps/web/src/server/people/profile"),
      import("../../apps/web/src/server/users/serialize"),
      import("../../apps/web/src/app/api/me/route"),
      import("../../apps/web/src/app/api/me/interests/route"),
      import("../../apps/web/src/app/api/users/[username]/route"),
      import("@gistroom/db"),
      import("../../apps/web/src/server/mail/notify-email"),
    ]);
  return {
    ...interests,
    ...profile,
    ...serialize,
    meRoute,
    interestsRoute,
    userRoute,
    welcome: vi.mocked(mail.emailWelcome),
    db: db.getDb(),
  };
}

describe.skipIf(!requireTestDb())("users and interests", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
    signedIn.user = null;
    m.welcome.mockClear();
  });
  afterAll(async () => {
    await resetTestDb();
  });

  type Person = Awaited<ReturnType<typeof person>>;
  async function person(key: string, over: Record<string, unknown> = {}) {
    return m.db.user.create({
      data: {
        email: `test_ui_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `testui${key}`,
        onboardedAt: new Date(),
        ...over,
      },
    });
  }
  const picks = (userId: string, slugs: string[]) =>
    m.db.userInterest.createMany({ data: slugs.map((topicSlug) => ({ userId, topicSlug })) });

  async function call(
    route: "meRoute" | "interestsRoute" | "userRoute",
    method: string,
    body?: unknown,
    params: Record<string, string> = {},
    origin: string | null = WEB_ORIGIN,
  ) {
    const handler = (
      m[route] as unknown as Record<string, (r: Request, c: unknown) => Promise<Response>>
    )[method];
    if (!handler) throw new Error(`no ${method}`);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (origin) headers.origin = origin;
    const res = await handler(
      new Request(`${WEB_ORIGIN}/api/x`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      { params: Promise.resolve(params) },
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  // ---------- Interests ----------

  it("replaces a person's whole list, lists it the same way every time, and leaves other people alone", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    await picks(bayo.id, ["football", "comedy", "gaming"]);

    expect(await m.setInterests(ada.id, ["comedy", "football", "comedy"])).toEqual([
      "comedy",
      "football",
    ]);
    expect(await m.getInterests(ada.id)).toEqual(["comedy", "football"]);
    await m.setInterests(ada.id, ["gaming"]);
    expect(await m.getInterests(ada.id)).toEqual(["gaming"]);
    expect(await m.getInterests(bayo.id)).toEqual(["comedy", "football", "gaming"]);
  });

  it("saves through the route only for the signed in person, and only valid lists", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    await picks(bayo.id, ["football", "comedy", "gaming"]);
    signedIn.user = ada;

    const ok = await call("interestsRoute", "PUT", { topics: ["football", "comedy", "gaming"] });
    expect(ok.status).toBe(200);
    expect(await m.getInterests(ada.id)).toEqual(["comedy", "football", "gaming"]);
    expect(m.welcome).toHaveBeenCalledTimes(1);

    // A second save is not a first save, so no second welcome.
    await call("interestsRoute", "PUT", { topics: ["football", "comedy", "gaming", "education"] });
    expect(m.welcome).toHaveBeenCalledTimes(1);

    const tooFew = await call("interestsRoute", "PUT", { topics: ["football"] });
    const tooMany = await call("interestsRoute", "PUT", {
      topics: Array.from({ length: 12 }, (_, i) => `topic-${i}`),
    });
    const unknown = await call("interestsRoute", "PUT", {
      topics: ["football", "comedy", "not-a-topic"],
    });
    const notAList = await call("interestsRoute", "PUT", { topics: "football" });
    const repeats = await call("interestsRoute", "PUT", {
      topics: ["football", "football", "football"],
    });
    for (const r of [tooFew, tooMany, unknown, notAList, repeats]) expect(r.status).toBe(400);
    expect(await m.getInterests(ada.id)).toHaveLength(4);
    // Nothing a person sends can reach another person's list.
    expect(await m.getInterests(bayo.id)).toEqual(["comedy", "football", "gaming"]);
  });

  it("refuses an interests save from another origin or without a session", async () => {
    const ada = await person("ada");
    const good = { topics: ["football", "comedy", "gaming"] };
    signedIn.user = ada;
    expect((await call("interestsRoute", "PUT", good, {}, "https://evil.example")).status).toBe(
      403,
    );
    expect((await call("interestsRoute", "PUT", good, {}, null)).status).toBe(403);
    signedIn.user = null;
    expect((await call("interestsRoute", "PUT", good)).status).toBe(401);
    expect((await call("interestsRoute", "GET")).status).toBe(401);
    expect(await m.getInterests(ada.id)).toEqual([]);
  });

  it("suggests people who share topics, most shared first, never friends, blocked or hidden people", async () => {
    const me = await person("me");
    const two = await person("two");
    const one = await person("one");
    const friend = await person("friend");
    const blocked = await person("blocked");
    const hidden = await person("hidden", { discoverable: false });
    const internal = await person("internal", { isInternal: true });
    const none = await person("none");
    await picks(me.id, ["football", "comedy", "gaming"]);
    await picks(two.id, ["football", "comedy"]);
    await picks(one.id, ["gaming", "education"]);
    for (const p of [friend, blocked, hidden, internal])
      await picks(p.id, ["football", "comedy", "gaming"]);
    await picks(none.id, ["education"]);
    const [low, high] = me.id < friend.id ? [me.id, friend.id] : [friend.id, me.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
    await m.db.block.create({ data: { blockerId: me.id, blockedId: blocked.id } });
    await m.db.friendRequest.create({ data: { requesterId: two.id, addresseeId: me.id } });

    const list = await m.suggestedPeople(me.id, ["football", "comedy", "gaming"]);
    expect(list.map((p) => p.username)).toEqual([two.username, one.username]);
    expect(list[0]?.sharedTopics).toHaveLength(2);
    expect(list[0]?.relationship).toBe("REQUEST_RECEIVED");
    expect(list[1]?.relationship).toBe("NONE");
    expect(JSON.stringify(list)).not.toContain("@example.com");
    expect(await m.suggestedPeople(me.id, [])).toEqual([]);
    const forInternal = await m.suggestedPeople(me.id, ["football"], true);
    expect(forInternal.map((p) => p.username)).toContain(internal.username);
  });

  // ---------- Profiles ----------

  it("shows a profile to anyone who may see it and to nobody who may not", async () => {
    const me = await person("me");
    const visible = await person("visible", { bio: "Hello", discoverable: false });
    const blocker = await person("blocker");
    const blocked = await person("blocked");
    await person("deleted", { status: "DELETED" });
    await person("suspended", { status: "SUSPENDED" });
    await person("unfinished", { onboardedAt: null });
    await m.db.block.create({ data: { blockerId: blocker.id, blockedId: me.id } });
    await m.db.block.create({ data: { blockerId: me.id, blockedId: blocked.id } });

    // A profile that is not in search is still reachable by its link, which is how a friend shares it.
    const seen = await m.getProfile(me, visible.username.toUpperCase());
    expect(seen).toMatchObject({ username: visible.username, bio: "Hello", relationship: "NONE" });
    expect(JSON.stringify(seen)).not.toContain("@example.com");
    for (const username of [
      blocker.username,
      blocked.username,
      "testuideleted",
      "testuisuspended",
      "testuiunfinished",
      "nobodyhere",
    ]) {
      expect(await m.getProfile(me, username)).toBeNull();
    }
    expect((await m.getProfile(me, me.username))?.relationship).toBe("NONE");
  });

  it("shows friendship, the chat, mutual friends and a request to accept on a profile", async () => {
    const me = await person("me");
    const friend = await person("friend");
    const mutual = await person("mutual");
    const asker = await person("asker");
    const link = async (a: Person, b: Person) => {
      const [low, high] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
    };
    await link(me, friend);
    await link(me, mutual);
    await link(friend, mutual);
    const chat = await m.db.conversation.create({
      data: {
        dmKey: me.id < friend.id ? `${me.id}:${friend.id}` : `${friend.id}:${me.id}`,
        members: { create: [{ userId: me.id }, { userId: friend.id }] },
      },
    });
    const request = await m.db.friendRequest.create({
      data: { requesterId: asker.id, addresseeId: me.id },
    });

    const f = await m.getProfile(me, friend.username);
    expect(f).toMatchObject({ relationship: "FRIENDS", mutualFriends: 1, conversationId: chat.id });
    expect(f?.friendsSince).toBeTruthy();
    const a = await m.getProfile(me, asker.username);
    expect(a).toMatchObject({ relationship: "REQUEST_RECEIVED", pendingRequestId: request.id });
  });

  it("answers the profile route with 404 for anyone hidden and 401 without a session", async () => {
    const me = await person("me");
    const other = await person("other");
    signedIn.user = me;
    const ok = await call("userRoute", "GET", undefined, { username: other.username });
    expect(ok.status).toBe(200);
    expect(JSON.stringify(ok.body)).not.toContain("@example.com");
    expect((await call("userRoute", "GET", undefined, { username: "nobodyhere" })).status).toBe(
      404,
    );
    signedIn.user = null;
    expect((await call("userRoute", "GET", undefined, { username: other.username })).status).toBe(
      401,
    );
  });

  // ---------- Own record ----------

  it("returns the signed in person's own record, with their email and nothing secret", async () => {
    const me = await person("me", { passwordHash: "scrypt$1$1$1$a$b" });
    signedIn.user = me;
    const res = await call("meRoute", "GET");
    const user = res.body.user as Record<string, unknown>;
    expect(user.email).toBe(me.email);
    expect(user.hasPassword).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("scrypt");
    expect(Object.keys(user)).not.toContain("passwordHash");
    // What other people see has no email at all.
    expect(Object.keys(m.toPublicUser(me))).not.toContain("email");
  });

  it("updates only the allowed profile fields of the signed in person", async () => {
    const me = await person("me");
    const other = await person("other");
    signedIn.user = me;
    const res = await call("meRoute", "PATCH", {
      name: "Ada Obi",
      bio: "",
      discoverable: false,
      timezone: "Africa/Lagos",
      role: "ADMIN",
      email: "attacker@example.com",
      username: "taken",
      id: other.id,
      status: "SUSPENDED",
    });
    expect(res.status).toBe(200);
    const after = await m.db.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(after).toMatchObject({
      name: "Ada Obi",
      bio: null,
      discoverable: false,
      timezone: "Africa/Lagos",
      role: "USER",
      email: me.email,
      username: me.username,
      status: "ACTIVE",
    });
    const untouched = await m.db.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(untouched.name).toBe(other.name);
  });

  it("refuses a bad profile, another origin and a missing session", async () => {
    const me = await person("me");
    signedIn.user = me;
    for (const body of [
      { timezone: "Not/AZone" },
      { name: "" },
      { bio: "a".repeat(161) },
      { roomInvitesFrom: "NOBODY" },
      { discoverable: "yes" },
    ]) {
      expect((await call("meRoute", "PATCH", body)).status).toBe(400);
    }
    expect(
      (await call("meRoute", "PATCH", { name: "X Y" }, {}, "https://evil.example")).status,
    ).toBe(403);
    signedIn.user = null;
    expect((await call("meRoute", "PATCH", { name: "X Y" })).status).toBe(401);
    expect((await m.db.user.findUniqueOrThrow({ where: { id: me.id } })).name).toBe(me.name);
  });
});
