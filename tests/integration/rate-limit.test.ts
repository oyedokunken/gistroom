import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();

async function load() {
  const [limiter, db] = await Promise.all([
    import("../../apps/web/src/server/rate-limit"),
    import("@gistroom/db"),
  ]);
  return { ...limiter, db: db.getDb() };
}

const DAY = 86_400_000;

describe.skipIf(!requireTestDb())("database rate limiter", () => {
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

  it("counts hits in one window and refuses the ones over the limit", async () => {
    const policy = { name: "test-limit", limit: 2, windowSec: 3600 };
    const now = new Date("2026-10-18T10:15:00Z");
    expect((await m.hit(policy, "a", now)).allowed).toBe(true);
    expect((await m.hit(policy, "a", now)).allowed).toBe(true);
    const third = await m.hit(policy, "a", now);
    expect(third).toMatchObject({ allowed: false, remaining: 0 });
    expect(third.retryAfterSec).toBeGreaterThan(0);
    // Another subject has its own count.
    expect((await m.hit(policy, "b", now)).allowed).toBe(true);
  });

  it("counts a new window from zero", async () => {
    const policy = { name: "test-window", limit: 1, windowSec: 60 };
    expect((await m.hit(policy, "a", new Date("2026-10-18T10:00:10Z"))).allowed).toBe(true);
    expect((await m.hit(policy, "a", new Date("2026-10-18T10:00:50Z"))).allowed).toBe(false);
    expect((await m.hit(policy, "a", new Date("2026-10-18T10:01:05Z"))).allowed).toBe(true);
  });

  it("removes only windows that can no longer count", async () => {
    const now = new Date("2026-10-18T10:00:00Z");
    const row = (key: string, ageMs: number) => ({
      key,
      windowStart: new Date(now.getTime() - ageMs),
      count: 1,
    });
    await m.db.rateLimit.createMany({
      data: [
        row("old-1", 5 * DAY),
        row("old-2", 3 * DAY),
        row("recent", 6 * 3_600_000),
        row("now", 0),
      ],
    });
    expect(await m.purgeRateLimits(now)).toBe(2);
    const left = await m.db.rateLimit.findMany({ select: { key: true }, orderBy: { key: "asc" } });
    expect(left.map((r) => r.key)).toEqual(["now", "recent"]);
    expect(await m.purgeRateLimits(now)).toBe(0);
  });
});
