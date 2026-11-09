import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { notificationListQuerySchema } from "@gistroom/shared";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();
if (testDbEnabled) process.env.REALTIME_URL = "http://nothing-listens.invalid";

async function load() {
  const [list, service, cursor, db] = await Promise.all([
    import("../../apps/web/src/server/notifications/list"),
    import("../../apps/web/src/server/notifications/service"),
    import("../../apps/web/src/server/cursor"),
    import("@gistroom/db"),
  ]);
  return { list, service, cursor, db: db.getDb() };
}

describe.skipIf(!requireTestDb())("notification paging and search", () => {
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
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
      },
    });
  }

  /** Walk every page the way the route does and return the ids in order. */
  async function walk(userId: string, input: Record<string, string>, limit = 3) {
    const ids: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 50; i += 1) {
      const query = notificationListQuerySchema.parse({ ...input, limit: String(limit) });
      const after = m.cursor.decodeCursor(cursor, m.list.isListCursor);
      const rows = await m.db.notification.findMany({
        where: m.list.notificationWhere(userId, query, after, new Date()),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      ids.push(...page.map((r) => r.id));
      const last = page[page.length - 1];
      if (rows.length <= limit || !last) return ids;
      cursor = m.cursor.encodeCursor({ t: last.createdAt.toISOString(), id: last.id });
    }
    throw new Error("paging did not end");
  }

  async function seedMany(userId: string, count: number, name: (i: number) => string) {
    const base = Date.now();
    const out: string[] = [];
    for (let i = 0; i < count; i += 1) {
      // Several rows share one timestamp on purpose: the id breaks the tie, so no row is skipped or repeated.
      const row = await m.db.notification.create({
        data: {
          userId,
          type: "CALL_MISSED",
          payload: { fromName: name(i) },
          createdAt: new Date(base - Math.floor(i / 2) * 1000),
        },
      });
      out.push(row.id);
    }
    return out;
  }

  it("pages every row exactly once across a stable order", async () => {
    const me = await person("page");
    const made = await seedMany(me.id, 11, (i) => `Ada ${i}`);
    const walked = await walk(me.id, {});
    expect(walked).toHaveLength(11);
    expect(new Set(walked).size).toBe(11);
    expect(new Set(walked)).toEqual(new Set(made));
  });

  it("searches names across pages, case insensitively, and never returns someone else's rows", async () => {
    const me = await person("me");
    const other = await person("other");
    await seedMany(me.id, 7, (i) => (i % 2 === 0 ? `Chidi ${i}` : `Bola ${i}`));
    await seedMany(other.id, 5, () => "Chidi Secret");
    const found = await walk(me.id, { q: "cHiDi" });
    expect(found).toHaveLength(4);
    const rows = await m.db.notification.findMany({ where: { id: { in: found } } });
    expect(rows.every((r) => r.userId === me.id)).toBe(true);
  });

  it("finds a notification by its type label and keeps activity out of the all tab", async () => {
    const me = await person("type");
    await m.db.notification.create({
      data: { userId: me.id, type: "CALL_MISSED", payload: {} },
    });
    await m.db.notification.create({
      data: { userId: me.id, type: "ROOM_INVITE", payload: { roomTitle: "Match gist" } },
    });
    await m.db.notification.create({
      data: {
        userId: me.id,
        type: "ACTIVITY",
        payload: { text: "You archived a chat" },
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    expect(await walk(me.id, { q: "missed call" })).toHaveLength(1);
    expect(await walk(me.id, { q: "match" })).toHaveLength(1);
    expect(await walk(me.id, { q: "archived" })).toHaveLength(0);
    expect(await walk(me.id, { tab: "activity", q: "archived" })).toHaveLength(1);
  });

  it("keeps the search after read, delete and clear, and the unread filter agrees", async () => {
    const me = await person("mutate");
    const ids = await seedMany(me.id, 6, (i) => `Tola ${i}`);
    expect(await walk(me.id, { q: "tola", unread: "1" })).toHaveLength(6);
    await m.service.markRead(me.id, ids.slice(0, 2));
    expect(await walk(me.id, { q: "tola", unread: "1" })).toHaveLength(4);
    expect(await walk(me.id, { q: "tola" })).toHaveLength(6);
    await m.db.notification.deleteMany({ where: { userId: me.id, id: { in: ids.slice(2, 4) } } });
    expect(await walk(me.id, { q: "tola" })).toHaveLength(4);
    await m.db.notification.deleteMany({ where: { userId: me.id, type: { not: "ACTIVITY" } } });
    expect(await walk(me.id, { q: "tola" })).toHaveLength(0);
  });
});
