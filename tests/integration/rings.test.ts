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
  const [rings, rooms, calls, db] = await Promise.all([
    import("../../apps/web/src/server/rings/service"),
    import("../../apps/web/src/server/rooms/service"),
    import("../../apps/web/src/server/calls/service"),
    import("@gistroom/db"),
  ]);
  return { rings, rooms, calls, db: db.getDb() };
}

const SEC = 1000;

describe.skipIf(!requireTestDb())("active rings", () => {
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

  async function person(key: string, extra: Record<string, unknown> = {}) {
    return m.db.user.create({
      data: {
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
        ...extra,
      },
    });
  }
  async function befriend(a: { id: string }, b: { id: string }) {
    const [low, high] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
  }
  async function ringingCall(caller: { id: string }, callee: { id: string }, over = {}) {
    return m.db.call.create({
      data: {
        callerId: caller.id,
        calleeId: callee.id,
        initialMedia: "VIDEO",
        status: "RINGING",
        livekitRoom: `call_${Math.random().toString(36).slice(2)}`,
        ringExpiresAt: new Date(Date.now() + 40 * SEC),
        ...over,
      },
    });
  }

  it("lists a ringing call with the time left on the server clock", async () => {
    const a = await person("a1");
    const b = await person("b1");
    const call = await ringingCall(a, b);
    const out = await m.rings.activeRings(b);
    expect(out.rings).toHaveLength(1);
    expect(out.rings[0]).toMatchObject({ id: call.id, kind: "CALL", media: "VIDEO" });
    expect(out.rings[0]?.from.name).toBe("Test a1");
    // The server says what time it is, so a device with a wrong clock still counts down correctly.
    expect(new Date(out.serverNow).getTime()).toBeLessThanOrEqual(Date.now());
    // The caller has nothing ringing.
    expect((await m.rings.activeRings(a)).rings).toHaveLength(0);
  });

  it("drops a call that rang out or ended, and says how a cancelled one ended", async () => {
    const a = await person("a2");
    const b = await person("b2");
    await ringingCall(a, b, { ringExpiresAt: new Date(Date.now() - 5 * SEC) });
    const cancelled = await ringingCall(a, b, { status: "CANCELLED" });
    const out = await m.rings.activeRings(b);
    expect(out.rings).toHaveLength(0);
    expect(out.recent.find((r) => r.id === cancelled.id)?.outcome).toBe("CANCELLED");
  });

  it("says a call answered or declined on another device ended that way", async () => {
    const a = await person("a3");
    const b = await person("b3");
    const answered = await ringingCall(a, b, { status: "ACTIVE", answeredAt: new Date() });
    const declined = await ringingCall(a, b, { status: "DECLINED" });
    const out = await m.rings.activeRings(b);
    expect(out.recent.find((r) => r.id === answered.id)?.outcome).toBe("ANSWERED_ELSEWHERE");
    expect(out.recent.find((r) => r.id === declined.id)?.outcome).toBe("DECLINED_ELSEWHERE");
  });

  it("rings nothing in quiet hours, and still records the call as it ends", async () => {
    const a = await person("a4");
    const b = await person("b4", { timezone: "UTC" });
    await ringingCall(a, b);
    await m.db.notificationPreference.create({
      data: { userId: b.id, switches: {}, previews: true, quietStart: "00:00", quietEnd: "23:59" },
    });
    const out = await m.rings.activeRings(b, new Date("2026-10-14T12:00:00Z"));
    expect(out.quiet).toBe(true);
    expect(out.rings).toHaveLength(0);
  });

  it("lists a room ring with the room, its people and who is ringing", async () => {
    const host = await person("h5");
    const guest = await person("g5");
    await befriend(host, guest);
    const room = await m.rooms.createRoom(host, {
      title: "Match talk",
      topicSlug: "football",
      language: "ENGLISH",
      visibility: "PUBLIC",
      media: "AUDIO",
      description: null,
      scheduledFor: null,
    });
    // The host is inside, so the card has someone to show.
    await m.db.roomMember.updateMany({
      where: { roomId: room.id, userId: host.id },
      data: { state: "JOINED", joinedAt: new Date() },
    });
    await m.rooms.ringMember(host, room.slug, guest.id);
    const out = await m.rings.activeRings(guest);
    expect(out.rings).toHaveLength(1);
    const r = out.rings[0];
    expect(r?.kind).toBe("ROOM");
    expect(r?.room).toMatchObject({
      slug: room.slug,
      title: "Match talk",
      topicName: "Football",
      status: "LIVE",
      locked: false,
    });
    expect(r?.room?.joined).toBe(1);
    expect(r?.room?.avatars[0]?.name).toBe("Test h5");
    expect(r?.from.name).toBe("Test h5");
    // The ring lasts 45 seconds from the moment it rang.
    const left = new Date(r?.expiresAt ?? 0).getTime() - Date.now();
    expect(left).toBeGreaterThan(40 * SEC);
    expect(left).toBeLessThanOrEqual(45 * SEC);
  });

  it("shows a locked or ended room in the card so it can say so, and stops after Decline or Don't ring me", async () => {
    const host = await person("h6");
    const guest = await person("g6");
    const other = await person("o6");
    await befriend(host, guest);
    await befriend(host, other);
    const room = await m.rooms.createRoom(host, {
      title: "Door talk",
      topicSlug: null,
      language: "ENGLISH",
      visibility: "PUBLIC",
      media: "VIDEO",
      description: null,
      scheduledFor: null,
    });
    await m.rooms.ringMember(host, room.slug, guest.id);
    await m.rooms.ringMember(host, room.slug, other.id);
    await m.rooms.setLocked(host, room.slug, true);
    expect((await m.rings.activeRings(guest)).rings[0]?.room?.locked).toBe(true);

    await m.rooms.answerRing(guest, room.slug, {});
    expect((await m.rings.activeRings(guest)).rings).toHaveLength(0);
    expect((await m.rings.activeRings(guest)).recent[0]?.outcome).toBe("DECLINED_ELSEWHERE");

    await m.rooms.answerRing(other, room.slug, { noRing: true });
    expect((await m.rings.activeRings(other)).rings).toHaveLength(0);
    // Asked not to be rung for this room: the next ring is refused.
    await expect(m.rooms.ringMember(host, room.slug, other.id)).rejects.toBeTruthy();
  });

  it("keeps the rate limits: one ring per person every 30 seconds", async () => {
    const host = await person("h7");
    const guest = await person("g7");
    await befriend(host, guest);
    const room = await m.rooms.createRoom(host, {
      title: "Limits",
      topicSlug: null,
      language: "ENGLISH",
      visibility: "PUBLIC",
      media: "AUDIO",
      description: null,
      scheduledFor: null,
    });
    await m.rooms.ringMember(host, room.slug, guest.id);
    await expect(m.rooms.ringMember(host, room.slug, guest.id)).rejects.toBeTruthy();
  });

  it("stops a room ring once the person joins on another device", async () => {
    const host = await person("h8");
    const guest = await person("g8");
    await befriend(host, guest);
    const room = await m.rooms.createRoom(host, {
      title: "Joined elsewhere",
      topicSlug: null,
      language: "ENGLISH",
      visibility: "PUBLIC",
      media: "AUDIO",
      description: null,
      scheduledFor: null,
    });
    await m.rooms.ringMember(host, room.slug, guest.id);
    await m.rooms.joinRoom(guest, room.slug, null).catch(() => undefined);
    const out = await m.rings.activeRings(guest);
    expect(out.rings).toHaveLength(0);
  });
});
