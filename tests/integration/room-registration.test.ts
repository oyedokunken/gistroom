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
  const [rooms, registration, mail, db] = await Promise.all([
    import("../../apps/web/src/server/rooms/service"),
    import("../../apps/web/src/server/rooms/registration"),
    import("../../apps/web/src/server/mail/transport"),
    import("@gistroom/db"),
  ]);
  return { rooms, registration, mail, db: db.getDb() };
}

const MIN = 60_000;
/** The notices are sent in the background, so give them a moment. */
const settle = () => new Promise((r) => setTimeout(r, 1500));

describe.skipIf(!requireTestDb())("room registration and reminders", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
    m.mail.capturedMail.length = 0;
  });
  afterAll(async () => {
    await resetTestDb();
  });

  async function person(key: string) {
    return m.db.user.create({
      data: {
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
      },
    });
  }
  async function scheduled(
    host: { id: string },
    inMin: number,
    over: Record<string, unknown> = {},
  ) {
    const user = await m.db.user.findUniqueOrThrow({ where: { id: host.id } });
    const room = await m.rooms.createRoom(user, {
      title: "Match talk",
      topicSlug: "football",
      language: "ENGLISH" as const,
      visibility: "PUBLIC" as const,
      media: "AUDIO" as const,
      description: null,
      scheduledFor: new Date(Date.now() + 120 * MIN).toISOString(),
      ...over,
    });
    // Move the start to where the test needs it, past the rule that new rooms start at least a minute out.
    await m.db.room.update({
      where: { slug: room.slug },
      data: { scheduledFor: new Date(Date.now() + inMin * MIN) },
    });
    return room;
  }
  const count = (userId: string, type: string) =>
    m.db.notification.count({ where: { userId, type: type as never } });

  it("confirms to the registrant, tells the host once in one row, and a second tap changes nothing", async () => {
    const host = await person("h1");
    const ada = await person("a1");
    const bola = await person("b1");
    const room = await scheduled(host, 120);
    await m.rooms.setGoing(ada, room.slug, true);
    await m.rooms.setGoing(ada, room.slug, true);
    await m.rooms.setGoing(bola, room.slug, true);
    await settle();

    expect(await m.db.notification.count({ where: { userId: ada.id, type: "ACTIVITY" } })).toBe(1);
    const mailToAda = m.mail.capturedMail.filter((x) => x.to === ada.email);
    expect(mailToAda).toHaveLength(1);
    expect(mailToAda[0]?.subject).toBe("You're registered for Match talk");
    expect(mailToAda[0]?.attachments?.[0]?.content).toContain("BEGIN:VCALENDAR");

    // The host has one row for the room, and it counts both people. It never reached push or email.
    const rows = await m.db.notification.findMany({
      where: { userId: host.id, type: "ROOM_REGISTRATIONS" },
    });
    expect(rows).toHaveLength(1);
    expect((rows[0]?.payload as { count: number }).count).toBe(2);
    expect(m.mail.capturedMail.filter((x) => x.to === host.email)).toHaveLength(0);
  });

  it("lets only invited people register for a private room, and not someone the host blocked", async () => {
    const host = await person("h2");
    const invited = await person("i2");
    const stranger = await person("s2");
    const blocked = await person("k2");
    const room = await scheduled(host, 120, { visibility: "PRIVATE" });
    await m.db.roomMember.create({
      data: {
        roomId: (await m.db.room.findUniqueOrThrow({ where: { slug: room.slug } })).id,
        userId: invited.id,
        state: "INVITED",
        invitedById: host.id,
      },
    });
    await expect(m.rooms.setGoing(stranger, room.slug, true)).rejects.toBeTruthy();
    const dto = await m.rooms.setGoing(invited, room.slug, true);
    expect(dto.going).toBe(true);
    await m.db.block.create({ data: { blockerId: host.id, blockedId: blocked.id } });
    await expect(m.rooms.setGoing(blocked, room.slug, true)).rejects.toBeTruthy();
  });

  it("sends the 15 minute reminder once, with a dedupe that survives repeated sweeps", async () => {
    const host = await person("h3");
    const ada = await person("a3");
    const room = await scheduled(host, 120);
    await m.rooms.setGoing(ada, room.slug, true);
    // Registered long before, now 12 minutes to go.
    await m.db.room.update({
      where: { slug: room.slug },
      data: { scheduledFor: new Date(Date.now() + 12 * MIN) },
    });
    await m.db.roomMember.updateMany({
      where: { userId: ada.id },
      data: { registeredAt: new Date(Date.now() - 3_600_000) },
    });
    m.mail.capturedMail.length = 0;
    const a = await m.registration.processRoomSchedule();
    const b = await m.registration.processRoomSchedule();
    await settle();
    expect(a.reminded).toBe(2);
    expect(b.reminded).toBe(0);
    expect(await count(ada.id, "ROOM_STARTING")).toBe(1);
    expect(await count(host.id, "ROOM_STARTING")).toBe(1);
    const mine = m.mail.capturedMail.filter((x) => x.to === ada.email);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.subject).toBe("Match talk starts in 15 minutes");
  });

  it("skips people who registered with under 15 minutes left, and a reminder that is too late", async () => {
    const host = await person("h4");
    const late = await person("l4");
    const room = await scheduled(host, 120);
    await m.rooms.setGoing(late, room.slug, true);
    await m.db.room.update({
      where: { slug: room.slug },
      data: { scheduledFor: new Date(Date.now() + 10 * MIN) },
    });
    // Registered just now with 10 minutes left: told when it starts at registration, not reminded.
    await m.registration.processRoomSchedule();
    await settle();
    expect(await count(late.id, "ROOM_STARTING")).toBe(0);

    // Four minutes to go is more than 10 minutes after the reminder was due, so nothing is sent.
    await m.db.roomMember.updateMany({
      where: { userId: late.id },
      data: { registeredAt: new Date(Date.now() - 3_600_000) },
    });
    await m.db.room.update({
      where: { slug: room.slug },
      data: { scheduledFor: new Date(Date.now() + 4 * MIN) },
    });
    const out = await m.registration.processRoomSchedule();
    expect(out.reminded).toBe(0);
  });

  it("says live now only when the host starts it, and not to anyone already inside or unregistered", async () => {
    const host = await person("h5");
    const ada = await person("a5");
    const bola = await person("b5");
    const cleo = await person("c5");
    const room = await scheduled(host, 5);
    await m.rooms.setGoing(ada, room.slug, true);
    await m.rooms.setGoing(bola, room.slug, true);
    await m.rooms.setGoing(cleo, room.slug, true);
    await m.rooms.setGoing(cleo, room.slug, false);
    // Time passes and the host has not started: the host is nudged, the registrants hear nothing.
    await m.db.room.update({
      where: { slug: room.slug },
      data: { scheduledFor: new Date(Date.now() - 1 * MIN) },
    });
    const out = await m.registration.processRoomSchedule();
    await settle();
    expect(out.dueHosts).toBe(1);
    expect(await count(host.id, "ROOM_DUE_HOST")).toBe(1);
    expect(await count(ada.id, "ROOM_LIVE_NOW")).toBe(0);

    m.mail.capturedMail.length = 0;
    // Bola is already inside when it starts.
    await m.db.roomMember.updateMany({ where: { userId: bola.id }, data: { state: "JOINED" } });
    await m.rooms.startRoom(host, room.slug);
    await m.rooms.startRoom(host, room.slug);
    await settle();
    expect(await count(ada.id, "ROOM_LIVE_NOW")).toBe(1);
    expect(await count(bola.id, "ROOM_LIVE_NOW")).toBe(0);
    expect(await count(cleo.id, "ROOM_LIVE_NOW")).toBe(0);
    expect(m.mail.capturedMail.filter((x) => x.to === ada.email)[0]?.subject).toBe(
      "Match talk is live now",
    );
  });

  it("moves the reminders when the host reschedules, and tells registrants the new time", async () => {
    const host = await person("h6");
    const ada = await person("a6");
    const room = await scheduled(host, 120);
    await m.rooms.setGoing(ada, room.slug, true);
    const next = new Date(Date.now() + 300 * MIN).toISOString();
    await m.rooms.updateSettings(host, room.slug, { scheduledFor: next });
    await settle();
    expect(await count(ada.id, "ROOM_RESCHEDULED")).toBe(1);
    const roomRow = await m.db.room.findUniqueOrThrow({ where: { slug: room.slug } });
    expect(roomRow.scheduledFor?.toISOString()).toBe(next);
    // The jobs now follow the new time.
    const jobs = await m.db.scheduledJob.findMany({
      where: { kind: "room-remind", processedAt: null },
    });
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      expect(j.dueAt.getTime()).toBeGreaterThan(Date.now() + 250 * MIN);
    }
    // A member cannot move a room.
    await expect(
      m.rooms.updateSettings(ada, room.slug, { scheduledFor: next }),
    ).rejects.toBeTruthy();
  });

  it("tells registrants when the host cancels, and when nobody came after the grace time", async () => {
    const host = await person("h7");
    const ada = await person("a7");
    const room = await scheduled(host, 120);
    await m.rooms.setGoing(ada, room.slug, true);
    await m.rooms.endRoom(host, room.slug);
    await settle();
    expect(await count(ada.id, "ROOM_CANCELLED")).toBe(1);

    const second = await scheduled(host, 120, { title: "Late talk" });
    await m.rooms.setGoing(ada, second.slug, true);
    await m.db.room.update({
      where: { slug: second.slug },
      data: { scheduledFor: new Date(Date.now() - 31 * MIN) },
    });
    m.mail.capturedMail.length = 0;
    const out = await m.registration.processRoomSchedule();
    await settle();
    expect(out.cancelled).toBe(1);
    expect(await count(ada.id, "ROOM_CANCELLED")).toBe(2);
    expect(m.mail.capturedMail.filter((x) => x.to === ada.email)[0]?.subject).toBe(
      "Late talk didn't start",
    );
    // Done once.
    expect((await m.registration.processRoomSchedule()).cancelled).toBe(0);
  });

  it("stops what was pending when a person unregisters", async () => {
    const host = await person("h8");
    const ada = await person("a8");
    const room = await scheduled(host, 120);
    await m.rooms.setGoing(ada, room.slug, true);
    await m.rooms.setGoing(ada, room.slug, false);
    await m.db.room.update({
      where: { slug: room.slug },
      data: { scheduledFor: new Date(Date.now() + 12 * MIN) },
    });
    await m.registration.processRoomSchedule();
    await m.rooms.startRoom(host, room.slug);
    await settle();
    expect(await count(ada.id, "ROOM_STARTING")).toBe(0);
    expect(await count(ada.id, "ROOM_LIVE_NOW")).toBe(0);
  });

  it("makes its wake up jobs on registration and clears them when the room starts", async () => {
    const host = await person("h9");
    const ada = await person("a9");
    const room = await scheduled(host, 120);
    await m.rooms.setGoing(ada, room.slug, true);
    expect(
      await m.db.scheduledJob.count({ where: { kind: "room-remind", processedAt: null } }),
    ).toBe(3);
    await m.rooms.startRoom(host, room.slug);
    expect(
      await m.db.scheduledJob.count({ where: { kind: "room-remind", processedAt: null } }),
    ).toBe(0);
  });
});
