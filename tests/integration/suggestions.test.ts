import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();
if (testDbEnabled) {
  process.env.REALTIME_URL = "http://nothing-listens.invalid";
}

async function load() {
  const [suggestions, db] = await Promise.all([
    import("../../apps/web/src/server/people/suggestions"),
    import("@gistroom/db"),
  ]);
  return { ...suggestions, db: db.getDb() };
}

describe.skipIf(!requireTestDb())("suggested friends", () => {
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

  let n = 0;
  async function person(key: string, over: Record<string, unknown> = {}, interests: string[] = []) {
    n += 1;
    const user = await m.db.user.create({
      data: {
        email: `test_sf_${key}${n}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_sf_${key}${n}`,
        onboardedAt: new Date(),
        ...over,
      },
    });
    if (interests.length > 0) {
      await m.db.userInterest.createMany({
        data: interests.map((topicSlug) => ({ userId: user.id, topicSlug })),
      });
    }
    return user;
  }
  async function befriend(a: { id: string }, b: { id: string }) {
    const [low, high] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
  }
  async function room(hostId: string, visibility: "PUBLIC" | "PRIVATE", members: string[]) {
    n += 1;
    const r = await m.db.room.create({
      data: {
        slug: `sfroom${n}${Date.now().toString(36)}`,
        hostId,
        title: `Room ${n}`,
        status: "ENDED",
        startedAt: new Date(Date.now() - 3_600_000),
        endedAt: new Date(),
        visibility,
        livekitRoom: `sf_lk_${n}_${Date.now().toString(36)}`,
      },
    });
    for (const userId of members) {
      await m.db.roomMember.create({
        data: {
          roomId: r.id,
          userId,
          state: "LEFT",
          joinedAt: new Date(Date.now() - 3_000_000),
          leftAt: new Date(),
        },
      });
    }
    return r;
  }
  const idsOf = async (viewer: { id: string; isInternal?: boolean }) =>
    (await m.suggestFriends({ id: viewer.id, isInternal: viewer.isInternal ?? false })).map(
      (p) => p.id,
    );

  it("suggests people with shared interests, mutual friends and public rooms, with plain reasons", async () => {
    const me = await person("me", {}, ["football", "music"]);
    const sameTopics = await person("topics", {}, ["football", "music", "tech"]);
    const friend = await person("friend");
    const fof = await person("fof");
    const roommate = await person("roommate");
    const host = await person("host");
    await befriend(me, friend);
    await befriend(friend, fof);
    await room(host.id, "PUBLIC", [me.id, roommate.id]);
    const list = await m.suggestFriends({ id: me.id, isInternal: false });
    const byId = new Map(list.map((p) => [p.id, p]));
    expect(byId.get(sameTopics.id)?.reasons).toEqual(["2 interests in common"]);
    expect(byId.get(fof.id)?.reasons).toEqual(["1 mutual friend"]);
    expect(byId.get(roommate.id)?.reasons).toEqual(["Often in the same public rooms"]);
    expect(byId.get(fof.id)?.mutualFriends).toBe(1);
  });

  it("never suggests yourself, friends, blocked, deleted, suspended, hidden or unfinished accounts", async () => {
    const me = await person("me2", {}, ["football"]);
    const friend = await person("f2", {}, ["football"]);
    const blocked = await person("b2", {}, ["football"]);
    const blockedMe = await person("bm2", {}, ["football"]);
    const deleted = await person("d2", { status: "DELETED" }, ["football"]);
    const suspended = await person("s2", { status: "SUSPENDED" }, ["football"]);
    const hidden = await person("h2", { discoverable: false }, ["football"]);
    const unfinished = await person("u2", { onboardedAt: null }, ["football"]);
    const internal = await person("i2", { isInternal: true }, ["football"]);
    const good = await person("g2", {}, ["football"]);
    await befriend(me, friend);
    await m.db.block.create({ data: { blockerId: me.id, blockedId: blocked.id } });
    await m.db.block.create({ data: { blockerId: blockedMe.id, blockedId: me.id } });
    const ids = await idsOf(me);
    expect(ids).toEqual([good.id]);
    for (const bad of [
      friend,
      blocked,
      blockedMe,
      deleted,
      suspended,
      hidden,
      unfinished,
      internal,
    ]) {
      expect(ids).not.toContain(bad.id);
    }
    expect(ids).not.toContain(me.id);
  });

  it("shows an internal account to another internal viewer only", async () => {
    const me = await person("me3", { isInternal: true }, ["football"]);
    const other = await person("o3", { isInternal: true }, ["football"]);
    expect(await idsOf(me)).toEqual([other.id]);
  });

  it("leaves out people with a pending request either way, or a retry cooldown", async () => {
    const me = await person("me4", {}, ["football"]);
    const sent = await person("sent4", {}, ["football"]);
    const received = await person("recv4", {}, ["football"]);
    const rejected = await person("rej4", {}, ["football"]);
    await m.db.friendRequest.create({
      data: { requesterId: me.id, addresseeId: sent.id, status: "PENDING" },
    });
    await m.db.friendRequest.create({
      data: { requesterId: received.id, addresseeId: me.id, status: "PENDING" },
    });
    await m.db.friendRequest.create({
      data: {
        requesterId: me.id,
        addresseeId: rejected.id,
        status: "REJECTED",
        respondedAt: new Date(),
        retryAfter: new Date(Date.now() + 86_400_000),
      },
    });
    expect(await idsOf(me)).toEqual([]);
  });

  it("does not let a private room show who was in it", async () => {
    const me = await person("me5");
    const secretMate = await person("mate5");
    const host = await person("host5");
    await room(host.id, "PRIVATE", [me.id, secretMate.id]);
    expect(await idsOf(me)).toEqual([]);
  });

  it("dismissal removes the person for good, and repeating it changes nothing", async () => {
    const me = await person("me6", {}, ["football"]);
    const a = await person("a6", {}, ["football"]);
    const b = await person("b6", {}, ["football"]);
    expect(new Set(await idsOf(me))).toEqual(new Set([a.id, b.id]));
    await m.dismissSuggestion(me.id, a.id);
    await m.dismissSuggestion(me.id, a.id);
    expect(await idsOf(me)).toEqual([b.id]);
    expect(await m.db.friendSuggestionDismissal.count({ where: { userId: me.id } })).toBe(1);
    await m.dismissSuggestion(me.id, me.id);
    expect(await m.db.friendSuggestionDismissal.count({ where: { userId: me.id } })).toBe(1);
  });

  it("returns the same order every time and a capped list", async () => {
    const me = await person("me7", {}, ["football"]);
    for (let i = 0; i < 16; i++) await person(`x7${i}`, {}, ["football"]);
    const first = await idsOf(me);
    const second = await idsOf(me);
    expect(first).toEqual(second);
    expect(first).toHaveLength(12);
  });

  it("is empty for someone with no interests, friends or rooms", async () => {
    const me = await person("me8");
    await person("x8", {}, ["football"]);
    expect(await idsOf(me)).toEqual([]);
  });

  it("never exposes an email or any private reason in the result", async () => {
    const me = await person("me9", {}, ["football"]);
    const other = await person("o9", {}, ["football"]);
    const json = JSON.stringify(await m.suggestFriends({ id: me.id, isInternal: false }));
    expect(json).not.toContain(other.email);
    expect(json).not.toMatch(/private|location/i);
  });
});
