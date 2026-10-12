import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";

prepareTestEnv();

async function load() {
  const [session, sweep, subs, auth, store, db] = await Promise.all([
    import("../../apps/web/src/server/auth/session"),
    import("../../apps/web/src/server/auth/sweep"),
    import("../../apps/web/src/server/push/subscriptions"),
    import("../../apps/web/src/server/auth/auth-service"),
    import("../../apps/realtime/src/prisma-store"),
    import("@gistroom/db"),
  ]);
  return { session, sweep, subs, auth, createPrismaStore: store.createPrismaStore, db: db.getDb() };
}

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

describe.skipIf(!testDbEnabled)("sessions and alerts", () => {
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

  async function person(key: string, passwordHash: string | null = null) {
    return m.db.user.create({
      data: {
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
        passwordHash,
      },
    });
  }

  async function session(
    userId: string,
    key: string,
    over: Partial<{
      deviceId: string;
      expiresAt: Date;
      createdAt: Date;
      endedAt: Date | null;
      authenticatedAt: Date;
    }> = {},
  ) {
    return m.db.session.create({
      data: {
        userId,
        tokenHash: `hash_${key}`,
        deviceId: over.deviceId ?? `device_${key}`.padEnd(30, "x"),
        deviceLabel: "Chrome on Windows",
        expiresAt: over.expiresAt ?? ahead(30),
        createdAt: over.createdAt,
        endedAt: over.endedAt ?? null,
        authenticatedAt: over.authenticatedAt,
      },
    });
  }

  async function sub(userId: string, key: string, deviceId: string | null) {
    return m.db.pushSubscription.create({
      data: {
        userId,
        endpoint: `https://push.example.com/${key}`,
        p256dh: "p",
        auth: "a",
        deviceId,
        deviceLabel: "Chrome on Windows",
      },
    });
  }

  const dev = (key: string) => `device_${key}`.padEnd(30, "x");

  it("sweeps only sessions that expired more than 7 days ago, never a valid one", async () => {
    const u = await person("sw1");
    await session(u.id, "valid", { expiresAt: ahead(5) });
    await session(u.id, "idle", { expiresAt: ahead(1), createdAt: ago(60) });
    await session(u.id, "recent", { expiresAt: ago(3) });
    await session(u.id, "old", { expiresAt: ago(10) });
    const out = await m.sweep.sweepSessions();
    expect(out.swept).toBe(1);
    const left = await m.db.session.findMany({ orderBy: { tokenHash: "asc" } });
    expect(left.map((s) => s.tokenHash)).toEqual(["hash_idle", "hash_recent", "hash_valid"]);
    // The one that ran out without anyone noticing now has a reason.
    expect(left.find((s) => s.tokenHash === "hash_recent")?.endReason).toBe("EXPIRED");
    expect(left.find((s) => s.tokenHash === "hash_valid")?.endReason).toBeNull();
  });

  it("writes a reason every time a session ends on purpose", async () => {
    const u = await person("rs1");
    const a = await session(u.id, "a", { deviceId: dev("a") });
    const b = await session(u.id, "b", { deviceId: dev("b") });
    const c = await session(u.id, "c", { deviceId: dev("c") });
    await m.session.revokeSession(a.id, u.id);
    expect((await m.db.session.findUniqueOrThrow({ where: { id: a.id } })).endReason).toBe(
      "REVOKED_BY_USER",
    );
    await m.session.revokeOtherSessions(u.id, b.id);
    const rows = await m.db.session.findMany({ where: { id: { in: [b.id, c.id] } } });
    expect(rows.find((r) => r.id === b.id)?.endedAt).toBeNull();
    expect(rows.find((r) => r.id === c.id)?.endReason).toBe("REVOKED_ALL");
  });

  it("sign out everywhere else never touches the current device or its alerts", async () => {
    const u = await person("ev1");
    const here = await session(u.id, "here", { deviceId: dev("here") });
    await session(u.id, "there", { deviceId: dev("there") });
    await sub(u.id, "here", dev("here"));
    await sub(u.id, "there", dev("there"));
    await m.session.revokeOtherSessions(u.id, here.id);
    const left = await m.db.pushSubscription.findMany();
    expect(left.map((s) => s.endpoint)).toEqual(["https://push.example.com/here"]);
    expect((await m.db.session.findUniqueOrThrow({ where: { id: here.id } })).endedAt).toBeNull();
  });

  it("signing out on purpose removes this device's alerts and only this device's", async () => {
    const u = await person("so1");
    const s = await session(u.id, "mine", { deviceId: dev("mine") });
    await session(u.id, "other", { deviceId: dev("other") });
    await sub(u.id, "mine", dev("mine"));
    await sub(u.id, "other", dev("other"));
    await m.session.signOutThisDevice(s.id, u.id, dev("mine"));
    const left = await m.db.pushSubscription.findMany();
    expect(left.map((x) => x.endpoint)).toEqual(["https://push.example.com/other"]);
  });

  it("session expiry never removes a subscription, and an expired device gets plain alerts", async () => {
    const u = await person("ex1");
    // Signed in 31 days ago on a device. The session ran out 1 day ago.
    await session(u.id, "gone", { deviceId: dev("gone"), expiresAt: ago(1), createdAt: ago(31) });
    const s = await sub(u.id, "gone", dev("gone"));
    await m.sweep.sweepSessions();
    expect(await m.db.pushSubscription.count({ where: { id: s.id } })).toBe(1);

    const n = await m.db.notification.create({
      data: { userId: u.id, type: "DM_MESSAGE", payload: { fromName: "Ada", count: 1 } },
    });
    const store = m.createPrismaStore();
    const bundle = await store.notificationBundle(n.id);
    expect(bundle?.subscriptions).toHaveLength(1);
    expect(bundle?.subscriptions[0]).toMatchObject({ plain: true });
    expect(bundle?.subscriptions[0]?.skip).toBeUndefined();
  });

  it("at +20 days the person is still signed in and gets full alerts, at +31 days plain ones", async () => {
    const u = await person("tc1");
    // +20 days: the session was made 20 days ago and still has 10 days left.
    await session(u.id, "live", {
      deviceId: dev("live"),
      createdAt: ago(20),
      expiresAt: ahead(10),
    });
    await sub(u.id, "live", dev("live"));
    const n = await m.db.notification.create({
      data: { userId: u.id, type: "DM_MESSAGE", payload: { fromName: "Ada" } },
    });
    const store = m.createPrismaStore();
    expect((await store.notificationBundle(n.id))?.subscriptions[0]?.plain).toBeUndefined();

    // +31 days with no activity: the session expired a day ago.
    await m.db.session.updateMany({ data: { createdAt: ago(31), expiresAt: ago(1) } });
    const later = await store.notificationBundle(n.id);
    expect(later?.subscriptions[0]?.plain).toBe(true);
    expect(await m.db.pushSubscription.count()).toBe(1);
  });

  it("stops after the 30 day grace and marks the device as needing a sign in", async () => {
    const u = await person("gr1");
    await session(u.id, "old", { deviceId: dev("old"), expiresAt: ago(45), createdAt: ago(75) });
    const s = await sub(u.id, "old", dev("old"));
    const n = await m.db.notification.create({
      data: { userId: u.id, type: "DM_MESSAGE", payload: {} },
    });
    const bundle = await m.createPrismaStore().notificationBundle(n.id);
    expect(bundle?.subscriptions[0]?.skip).toBe(true);
    expect(
      (await m.db.pushSubscription.findUniqueOrThrow({ where: { id: s.id } })).needsReauth,
    ).toBe(true);
    // Signing in again on that device brings it back to full alerts.
    await session(u.id, "again", { deviceId: dev("old") });
    const back = await m.createPrismaStore().notificationBundle(n.id);
    expect(back?.subscriptions[0]).toMatchObject({ id: s.id });
    expect(back?.subscriptions[0]?.skip).toBeUndefined();
    expect(back?.subscriptions[0]?.plain).toBeUndefined();
    expect(
      (await m.db.pushSubscription.findUniqueOrThrow({ where: { id: s.id } })).needsReauth,
    ).toBe(false);
  });

  it("moves a subscription to the next person who signs in on the same browser", async () => {
    const first = await person("ra1");
    const second = await person("ra2");
    const input = { endpoint: "https://push.example.com/shared", p256dh: "p", auth: "a" };
    await m.subs.saveSubscription(first, input, {
      deviceId: dev("shared"),
      userAgent: "Chrome/120 Windows",
    });
    await m.subs.saveSubscription(second, input, {
      deviceId: dev("shared"),
      userAgent: "Chrome/120 Windows",
    });
    const rows = await m.db.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(second.id);
  });

  it("counts failures, calls a device unhealthy after three, and keeps the row after a session ends", async () => {
    const u = await person("hl1");
    const s = await sub(u.id, "hl", null);
    const store = m.createPrismaStore();
    for (let i = 0; i < 2; i += 1) {
      await store.recordPushResult({ subscriptionId: s.id, ok: false, revoke: false });
    }
    expect(
      (await m.db.pushSubscription.findUniqueOrThrow({ where: { id: s.id } })).unhealthyAt,
    ).toBeNull();
    await store.recordPushResult({ subscriptionId: s.id, ok: false, revoke: false });
    const bad = await m.db.pushSubscription.findUniqueOrThrow({ where: { id: s.id } });
    expect(bad.unhealthyAt).not.toBeNull();
    expect(bad.failureCount).toBe(3);
    await store.recordPushResult({ subscriptionId: s.id, ok: true, revoke: false });
    const ok = await m.db.pushSubscription.findUniqueOrThrow({ where: { id: s.id } });
    expect(ok).toMatchObject({ unhealthyAt: null, failureCount: 0 });
    expect(ok.lastSuccessAt).not.toBeNull();
  });

  it("revokes a dead subscription and the sweep removes stale ones", async () => {
    const u = await person("dd1");
    const dead = await sub(u.id, "dead", null);
    await m
      .createPrismaStore()
      .recordPushResult({ subscriptionId: dead.id, ok: false, revoke: true });
    expect(
      (await m.db.pushSubscription.findUniqueOrThrow({ where: { id: dead.id } })).revokedAt,
    ).not.toBeNull();

    const stale = await sub(u.id, "stale", null);
    await m.db.pushSubscription.update({
      where: { id: stale.id },
      data: { lastSuccessAt: ago(100) },
    });
    const fresh = await sub(u.id, "fresh", null);
    await m.db.pushSubscription.update({
      where: { id: fresh.id },
      data: { lastSuccessAt: ago(5) },
    });
    await m.db.pushSubscription.update({ where: { id: dead.id }, data: { revokedAt: ago(10) } });
    await m.sweep.sweepSubscriptions();
    const left = await m.db.pushSubscription.findMany();
    expect(left.map((x) => x.id)).toEqual([fresh.id]);
  });

  it("asks for a recent sign in before sensitive actions", async () => {
    const stale = await person("su1");
    const fresh = await person("su2");
    const old = await session(stale.id, "old", { authenticatedAt: ago(1) });
    const recent = await session(fresh.id, "recent");
    expect(m.session.hasRecentAuth(old)).toBe(false);
    expect(m.session.hasRecentAuth(recent)).toBe(true);
    expect(() => m.session.requireRecentAuth({ session: old, user: stale })).toThrowError(
      /Confirm your password/,
    );
    // A Google person with no password cannot set one after a stale sign in, until they sign in again.
    await expect(
      m.auth.changePassword(stale, old.id, { newPassword: "a long enough passphrase 123" }),
    ).rejects.toMatchObject({ status: 403, code: "REAUTH" });
    await m.session.markAuthenticated(old.id);
    await expect(
      m.auth.changePassword(stale, old.id, { newPassword: "a long enough passphrase 123" }),
    ).resolves.toBeUndefined();
  });
});
