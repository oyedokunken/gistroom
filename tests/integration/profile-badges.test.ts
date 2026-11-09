import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();
if (testDbEnabled) {
  process.env.REALTIME_URL = "http://nothing-listens.invalid";
}

async function load() {
  const [badges, profile, activity, verify, locked, mail, db] = await Promise.all([
    import("../../apps/web/src/server/badges"),
    import("../../apps/web/src/server/people/profile"),
    import("../../apps/web/src/server/activity"),
    import("../../apps/web/src/server/account/verify-email"),
    import("../../apps/web/src/server/users/locked-fields"),
    import("../../apps/web/src/server/mail/transport"),
    import("@gistroom/db"),
  ]);
  return {
    ...badges,
    ...profile,
    ...activity,
    ...verify,
    ...locked,
    mail,
    db: db.getDb(),
    toPublicUser: db.toPublicUser,
  };
}

const MIN = 60_000;

describe.skipIf(!requireTestDb())("profiles, badges and email verification", () => {
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

  let n = 0;
  async function person(key: string, over: Record<string, unknown> = {}) {
    n += 1;
    return m.db.user.create({
      data: {
        email: `test_pb_${key}${n}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_pb_${key}${n}`,
        onboardedAt: new Date(),
        ...over,
      },
    });
  }
  const fresh = (id: string) => m.db.user.findUniqueOrThrow({ where: { id } });

  async function endedRoom(
    hostId: string,
    over: { topic?: string; peak?: number; members?: string[] } = {},
  ) {
    const topic = over.topic
      ? await m.db.topic.upsert({
          where: { slug: over.topic },
          update: {},
          create: { slug: over.topic, name: over.topic, description: over.topic },
        })
      : null;
    n += 1;
    const room = await m.db.room.create({
      data: {
        slug: `pbroom${n}${Date.now().toString(36)}`,
        hostId,
        title: `Room ${n}`,
        topicId: topic?.id ?? null,
        status: "ENDED",
        startedAt: new Date(Date.now() - 60 * MIN),
        endedAt: new Date(),
        peakParticipants: over.peak ?? 3,
        livekitRoom: `pb_lk_${n}_${Date.now().toString(36)}`,
      },
    });
    for (const userId of over.members ?? []) {
      await m.db.roomMember.create({
        data: {
          roomId: room.id,
          userId,
          state: "LEFT",
          joinedAt: new Date(Date.now() - 50 * MIN),
          leftAt: new Date(Date.now() - 20 * MIN),
        },
      });
    }
    return room;
  }

  describe("badges", () => {
    it("grants First room host and then Room host as completed rooms add up, once each", async () => {
      const host = await person("host");
      const guest = await person("guest");
      await endedRoom(host.id, { members: [guest.id] });
      const first = await m.grantBadges(host.id);
      expect(first.map((g) => g.badge)).toEqual(["FIRST_ROOM_HOST"]);
      expect(await m.grantBadges(host.id)).toEqual([]);

      for (let i = 0; i < 4; i++) await endedRoom(host.id, { members: [guest.id] });
      const next = await m.grantBadges(host.id);
      expect(next.map((g) => g.badge)).toContain("ROOM_HOST");
      expect(await m.db.badgeGrant.count({ where: { userId: host.id, badge: "ROOM_HOST" } })).toBe(
        1,
      );

      const row = await fresh(host.id);
      expect(row.badgesPublic).toEqual(
        [
          { badge: "FIRST_ROOM_HOST", count: 1 },
          { badge: "ROOM_HOST", count: 1 },
          { badge: "HELPFUL_HOST", count: 0 },
        ].filter((b) => b.count > 0),
      );
      expect(
        await m.db.auditLog.count({ where: { action: "badge.grant", targetId: host.id } }),
      ).toBe(2);
    });

    it("does not count a room nobody else joined, or one that never ended", async () => {
      const host = await person("lonely");
      await endedRoom(host.id, { peak: 1 });
      await m.db.room.create({
        data: {
          slug: `pblive${Date.now().toString(36)}`,
          hostId: host.id,
          title: "Still going",
          status: "LIVE",
          startedAt: new Date(),
          peakParticipants: 9,
          livekitRoom: `pb_lk_live_${Date.now().toString(36)}`,
        },
      });
      expect(await m.grantBadges(host.id)).toEqual([]);
    });

    it("grants the same ordinal once when two workers race", async () => {
      const host = await person("race");
      await endedRoom(host.id);
      await Promise.all([m.grantBadges(host.id), m.grantBadges(host.id), m.grantBadges(host.id)]);
      expect(
        await m.db.badgeGrant.count({ where: { userId: host.id, badge: "FIRST_ROOM_HOST" } }),
      ).toBe(1);
    });

    it("counts rooms attended, rooms stayed in, and topics across hosted and attended rooms", async () => {
      const host = await person("th");
      const guest = await person("tg");
      for (const topic of ["football", "music", "tech", "comedy", "gaming"]) {
        await endedRoom(host.id, { topic, members: [guest.id] });
      }
      await m.grantBadges(guest.id);
      const held = await m.db.badgeGrant.findMany({ where: { userId: guest.id } });
      const keys = held.map((g) => g.badge).sort();
      expect(keys).toEqual(["GOOD_LISTENER", "REGULAR_ATTENDEE", "TOPIC_EXPLORER"]);
    });

    it("counts friends who are active and not blocked, and leaves out internal accounts", async () => {
      const me = await person("fr");
      const others = [];
      for (let i = 0; i < 12; i++) {
        others.push(await person(`fr${i}`, i === 0 ? { isInternal: true } : {}));
      }
      for (const o of others) {
        const [low, high] = me.id < o.id ? [me.id, o.id] : [o.id, me.id];
        await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
      }
      // 11 count. One of them blocked me, so 10 count.
      await m.db.block.create({ data: { blockerId: others[1]!.id, blockedId: me.id } });
      await m.grantBadges(me.id);
      expect(
        await m.db.badgeGrant.count({ where: { userId: me.id, badge: "COMMUNITY_BUILDER" } }),
      ).toBe(1);
      // Remove one friend from the count and the next ordinal is not granted.
      await m.db.block.create({ data: { blockerId: me.id, blockedId: others[2]!.id } });
      expect(await m.computeBadgeStats(me.id)).toMatchObject({ friends: 9 });
    });

    it("counts days of activity and writes them once a day", async () => {
      const p = await person("act");
      await m.touchActivity(p.id, new Date("2026-11-02T10:00:00Z"));
      await m.touchActivity(p.id, new Date("2026-11-02T11:00:00Z"));
      expect(await m.db.activityDay.count({ where: { userId: p.id } })).toBe(1);
      expect((await fresh(p.id)).lastActiveAt).not.toBeNull();
      for (const d of ["03", "04", "05", "06"]) {
        await m.db.activityDay.create({
          data: { userId: p.id, day: new Date(`2026-11-${d}T00:00:00Z`) },
        });
      }
      await m.grantBadges(p.id);
      expect(
        await m.db.badgeGrant.count({ where: { userId: p.id, badge: "CONSISTENT_GIST" } }),
      ).toBe(1);
    });

    it("keeps Trusted reporter private: granted, shown to the owner, never next to a name", async () => {
      const p = await person("rep");
      await m.db.report.create({
        data: {
          reporterId: p.id,
          targetType: "USER",
          targetId: "someone",
          reason: "SPAM",
          status: "RESOLVED",
          resolution: "Warned the person",
        },
      });
      await m.grantBadges(p.id);
      expect(
        await m.db.badgeGrant.count({ where: { userId: p.id, badge: "TRUSTED_REPORTER" } }),
      ).toBe(1);
      expect((await fresh(p.id)).badgesPublic).toEqual([]);
      expect((await m.badgesFor(p.id, { includePrivate: true })).map((b) => b.badge)).toEqual([
        "TRUSTED_REPORTER",
      ]);
      expect(await m.badgesFor(p.id, { includePrivate: false })).toEqual([]);
    });

    it("stops granting Helpful host while a report against the host is open", async () => {
      const host = await person("hh");
      for (let i = 0; i < 10; i++) await endedRoom(host.id);
      await m.db.report.create({
        data: {
          reporterId: (await person("hhr")).id,
          targetType: "USER",
          targetId: host.id,
          reason: "HARASSMENT",
        },
      });
      await m.grantBadges(host.id);
      expect(
        await m.db.badgeGrant.count({ where: { userId: host.id, badge: "HELPFUL_HOST" } }),
      ).toBe(0);
      expect(await m.db.badgeGrant.count({ where: { userId: host.id, badge: "ROOM_HOST" } })).toBe(
        2,
      );
    });

    it("revokes with an audit entry, keeps the row, and never grants the same ordinal again", async () => {
      const host = await person("rv");
      const admin = await person("admin", { role: "ADMIN" });
      await endedRoom(host.id);
      await m.grantBadges(host.id);
      expect(
        await m.revokeBadge({
          actorId: admin.id,
          userId: host.id,
          badge: "FIRST_ROOM_HOST",
          reason: "test",
        }),
      ).toBe(1);
      const row = await m.db.badgeGrant.findFirstOrThrow({ where: { userId: host.id } });
      expect(row.revokedAt).not.toBeNull();
      expect(row.revokedById).toBe(admin.id);
      expect((await fresh(host.id)).badgesPublic).toEqual([]);
      expect(await m.grantBadges(host.id)).toEqual([]);
      expect(
        await m.db.auditLog.count({ where: { action: "badge.revoke", targetId: host.id } }),
      ).toBe(1);
    });

    it("hides badges next to a name when the person turns them off, and keeps the record", async () => {
      const host = await person("hide");
      await endedRoom(host.id);
      await m.grantBadges(host.id);
      expect(m.toPublicUser(await fresh(host.id)).badges).toEqual([
        { badge: "FIRST_ROOM_HOST", count: 1 },
      ]);
      await m.db.user.update({ where: { id: host.id }, data: { showBadges: false } });
      expect(m.toPublicUser(await fresh(host.id)).badges).toBeUndefined();
      expect(await m.db.badgeGrant.count({ where: { userId: host.id } })).toBe(1);
    });

    it("deletes badge records with the account's data", async () => {
      const p = await person("del");
      await m.db.activityDay.createMany({
        data: ["01", "02", "03", "04", "05"].map((d) => ({
          userId: p.id,
          day: new Date(`2026-11-${d}T00:00:00Z`),
        })),
      });
      await m.grantBadges(p.id);
      expect(await m.db.badgeGrant.count({ where: { userId: p.id } })).toBe(1);
      await m.db.user.delete({ where: { id: p.id } });
      expect(await m.db.badgeGrant.count({ where: { userId: p.id } })).toBe(0);
    });
  });

  describe("profile view", () => {
    it("shows joined date, friend total, interests, verified status and badges, and never the email", async () => {
      const viewer = await person("viewer");
      const target = await person("target", { createdAt: new Date("2026-03-10T10:00:00Z") });
      const friend = await person("tf");
      const [low, high] = target.id < friend.id ? [target.id, friend.id] : [friend.id, target.id];
      await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
      await m.db.userInterest.createMany({
        data: [
          { userId: target.id, topicSlug: "football" },
          { userId: target.id, topicSlug: "comedy" },
        ],
      });
      await endedRoom(target.id);
      await m.grantBadges(target.id);
      const view = await m.getProfile(viewer, target.username);
      expect(view).not.toBeNull();
      expect(view?.joinedAt).toBe("2026-03-10T10:00:00.000Z");
      expect(view?.friendCount).toBe(1);
      expect(view?.interests.map((i) => i.slug).sort()).toEqual(["comedy", "football"]);
      expect(view?.emailVerified).toBe(true);
      expect(view?.badges.map((b) => b.badge)).toEqual(["FIRST_ROOM_HOST"]);
      expect(JSON.stringify(view)).not.toContain(target.email);
    });

    it("shows the owner private badges and hides all badges from visitors when the owner hides them", async () => {
      const owner = await person("own");
      const visitor = await person("vis");
      await m.db.report.create({
        data: {
          reporterId: owner.id,
          targetType: "USER",
          targetId: "x",
          reason: "SPAM",
          status: "RESOLVED",
          resolution: "Done",
        },
      });
      await endedRoom(owner.id);
      const own = await m.getProfile(await fresh(owner.id), owner.username);
      expect(own?.badges.map((b) => b.badge).sort()).toEqual([
        "FIRST_ROOM_HOST",
        "TRUSTED_REPORTER",
      ]);
      const seen = await m.getProfile(visitor, owner.username);
      expect(seen?.badges.map((b) => b.badge)).toEqual(["FIRST_ROOM_HOST"]);
      await m.db.user.update({ where: { id: owner.id }, data: { showBadges: false } });
      const hidden = await m.getProfile(visitor, owner.username);
      expect(hidden).toMatchObject({ badges: [], badgesHidden: true });
      const stillOwn = await m.getProfile(await fresh(owner.id), owner.username);
      expect(stillOwn?.badges.length).toBe(2);
    });

    it("does not show unverified status as verified, and answers null for deleted, suspended and blocked people", async () => {
      const viewer = await person("v2");
      const unverified = await person("unv", { emailVerifiedAt: null });
      expect((await m.getProfile(viewer, unverified.username))?.emailVerified).toBe(false);

      const gone = await person("gone", { status: "DELETED" });
      const suspended = await person("susp", { status: "SUSPENDED" });
      const blocker = await person("blk");
      await m.db.block.create({ data: { blockerId: blocker.id, blockedId: viewer.id } });
      expect(await m.getProfile(viewer, gone.username)).toBeNull();
      expect(await m.getProfile(viewer, suspended.username)).toBeNull();
      expect(await m.getProfile(viewer, blocker.username)).toBeNull();
    });

    it("counts only active friends in the total", async () => {
      const viewer = await person("v3");
      const target = await person("tt");
      for (const status of ["ACTIVE", "ACTIVE", "SUSPENDED"] as const) {
        const f = await person(`ff${status}`, { status });
        const [low, high] = target.id < f.id ? [target.id, f.id] : [f.id, target.id];
        await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
      }
      expect((await m.getProfile(viewer, target.username))?.friendCount).toBe(2);
    });
  });

  describe("email verification", () => {
    it("sends a code to the account address and verifies it", async () => {
      const p = await person("ver", { emailVerifiedAt: null });
      await m.startEmailVerification(await fresh(p.id), "198.51.100.1");
      const mailed = m.mail.capturedMail.filter((x) => x.to === p.email);
      expect(mailed).toHaveLength(1);
      const code = /\b(\d{6})\b/.exec(mailed[0]!.text ?? "")?.[1];
      expect(code).toBeTruthy();
      const res = await m.confirmEmailVerification(
        await fresh(p.id),
        { code: code! },
        "198.51.100.1",
      );
      expect(res.verifiedAt).toBeInstanceOf(Date);
      expect((await fresh(p.id)).emailVerifiedAt).not.toBeNull();
    });

    it("refuses a wrong code and locks after five wrong tries", async () => {
      const p = await person("ver2", { emailVerifiedAt: null });
      await m.startEmailVerification(await fresh(p.id), "198.51.100.2");
      for (let i = 0; i < 5; i++) {
        await expect(
          m.confirmEmailVerification(await fresh(p.id), { code: "000000" }, "198.51.100.2"),
        ).rejects.toBeTruthy();
      }
      expect((await fresh(p.id)).emailVerifiedAt).toBeNull();
      await expect(
        m.startEmailVerification(await fresh(p.id), "198.51.100.2"),
      ).rejects.toMatchObject({
        status: 429,
      });
    });

    it("makes a second request wait, and refuses an already verified account", async () => {
      const p = await person("ver3", { emailVerifiedAt: null });
      await m.startEmailVerification(await fresh(p.id), "198.51.100.3");
      await expect(
        m.startEmailVerification(await fresh(p.id), "198.51.100.3"),
      ).rejects.toMatchObject({
        status: 429,
      });
      const done = await person("ver4");
      await expect(
        m.startEmailVerification(await fresh(done.id), "198.51.100.4"),
      ).rejects.toMatchObject({
        status: 409,
      });
    });

    it("refuses an expired code", async () => {
      const p = await person("ver5", { emailVerifiedAt: null });
      await m.startEmailVerification(await fresh(p.id), "198.51.100.5");
      await m.db.otpChallenge.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      const code = /\b(\d{6})\b/.exec(m.mail.capturedMail.at(-1)?.text ?? "")?.[1] ?? "123456";
      await expect(
        m.confirmEmailVerification(await fresh(p.id), { code }, "198.51.100.5"),
      ).rejects.toBeTruthy();
    });
  });

  describe("permanent email and username", () => {
    it("refuses a request that names either field, naming the field", () => {
      expect(() => m.rejectLockedFields({ name: "New name" })).not.toThrow();
      expect(() => m.rejectLockedFields({ email: "new@example.com" })).toThrowError(/permanent/);
      expect(() => m.rejectLockedFields({ username: "taken", bio: "x" })).toThrowError(/permanent/);
      try {
        m.rejectLockedFields({ email: "a@b.co", username: "x" });
      } catch (e) {
        expect(e).toMatchObject({
          status: 400,
          extra: { fields: { email: expect.any(String), username: expect.any(String) } },
        });
      }
    });
    it("ignores bodies that are not objects", () => {
      expect(() => m.rejectLockedFields(null)).not.toThrow();
      expect(() => m.rejectLockedFields([{ email: "x" }])).not.toThrow();
      expect(() => m.rejectLockedFields("email")).not.toThrow();
    });
  });
});
