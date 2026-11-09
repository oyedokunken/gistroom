import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();
if (testDbEnabled) process.env.REALTIME_URL = "http://nothing-listens.invalid";

async function load() {
  const [reengage, mail, db] = await Promise.all([
    import("../../apps/web/src/server/reengage"),
    import("../../apps/web/src/server/mail/transport"),
    import("@gistroom/db"),
  ]);
  return { reengage, mail, db: db.getDb() };
}

const DAY = 86_400_000;

describe.skipIf(!requireTestDb())("come back nudges", () => {
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

  async function person(key: string, over: Record<string, unknown> = {}, idleDays = 12) {
    const idle = new Date(Date.now() - idleDays * DAY);
    const user = await m.db.user.create({
      data: {
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
        createdAt: new Date(Date.now() - 100 * DAY),
        lastActiveAt: idle,
        ...over,
      },
    });
    return user;
  }

  it("emails and notifies an inactive person once, even when the sweep runs again", async () => {
    const u = await person("idle");
    const first = await m.reengage.sendReengagement();
    expect(first.emailed).toBe(1);
    const again = await m.reengage.sendReengagement();
    expect(again.emailed).toBe(0);
    expect(m.mail.capturedMail.filter((x) => x.to === u.email)).toHaveLength(1);
    const rows = await m.db.notification.findMany({ where: { userId: u.id, type: "REENGAGE" } });
    expect(rows).toHaveLength(1);
    const notices = await m.db.reengagementNotice.findMany({ where: { userId: u.id } });
    expect(notices.map((n) => `${n.channel}:${n.status}`).sort()).toEqual([
      "EMAIL:SENT",
      "IN_APP:SENT",
    ]);
  });

  it("never mails seed, internal, suspended, unverified or recently active people", async () => {
    await person("seed", { isSeed: true });
    await person("internal", { isInternal: true });
    await person("suspended", { status: "SUSPENDED" });
    await person("unverified", { emailVerifiedAt: null });
    await person("active", { lastActiveAt: new Date() });
    const out = await m.reengage.sendReengagement();
    expect(out.emailed).toBe(0);
    expect(m.mail.capturedMail).toHaveLength(0);
  });

  it("a recent session counts as being back", async () => {
    const u = await person("session");
    await m.db.session.create({
      data: {
        tokenHash: "test_hash_session",
        userId: u.id,
        lastSeenAt: new Date(Date.now() - DAY),
        expiresAt: new Date(Date.now() + DAY),
      },
    });
    expect((await m.reengage.sendReengagement()).emailed).toBe(0);
  });

  it("respects the email switch and sends the in app notice anyway", async () => {
    const u = await person("off");
    await m.db.notificationPreference.create({
      data: { userId: u.id, switches: { REENGAGE: { inApp: true, push: false, email: false } } },
    });
    const out = await m.reengage.sendReengagement();
    expect(out.emailed).toBe(0);
    expect(m.mail.capturedMail).toHaveLength(0);
    expect(await m.db.notification.count({ where: { userId: u.id, type: "REENGAGE" } })).toBe(1);
  });

  it("holds the email in quiet hours and sends it on a later run", async () => {
    const u = await person("quiet");
    await m.db.notificationPreference.create({
      data: { userId: u.id, quietStart: "00:00", quietEnd: "23:59" },
    });
    expect((await m.reengage.sendReengagement()).held).toBe(1);
    expect(m.mail.capturedMail).toHaveLength(0);
    await m.db.notificationPreference.update({
      where: { userId: u.id },
      data: { quietStart: null, quietEnd: null },
    });
    expect((await m.reengage.sendReengagement()).emailed).toBe(1);
    expect(await m.db.notification.count({ where: { userId: u.id, type: "REENGAGE" } })).toBe(1);
  });

  it("honours the cooldown and the yearly cap for a person who keeps coming back", async () => {
    const u = await person("cap", {}, 12);
    for (const daysAgo of [40, 90, 150]) {
      await m.db.reengagementNotice.create({
        data: {
          userId: u.id,
          windowStart: new Date(Date.now() - (daysAgo + 10) * DAY),
          channel: "EMAIL",
          status: "SENT",
          sentAt: new Date(Date.now() - daysAgo * DAY),
        },
      });
    }
    expect((await m.reengage.sendReengagement()).emailed).toBe(0);
    expect(m.mail.capturedMail).toHaveLength(0);
  });

  it("skips a recipient outside the allowed domains for good", async () => {
    const u = await person("blocked", { email: "test_blocked@not-allowed.invalid" });
    for (let i = 0; i < 4; i += 1) await m.reengage.sendReengagement();
    const emailRow = await m.db.reengagementNotice.findFirst({
      where: { userId: u.id, channel: "EMAIL" },
    });
    // A recipient outside the allowed domains is skipped for good, never retried forever.
    expect(["SKIPPED", "FAILED"]).toContain(emailRow?.status);
    expect(m.mail.capturedMail).toHaveLength(0);
  });
});
