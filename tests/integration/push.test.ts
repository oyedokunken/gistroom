import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();

const WEB_ORIGIN = "http://localhost:3000";
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// The routes read the signed in person and the browser's cookies. Here both come from variables the tests set.
const current = vi.hoisted(() => ({
  user: null as unknown,
  deviceCookie: undefined as string | undefined,
  userAgent: "",
}));
vi.mock("@/server/auth/session", async () => {
  const { unauthorized } = await import("@/server/http");
  return {
    requireOnboarded: async () => {
      if (!current.user) throw unauthorized();
      return { user: current.user, session: { id: "test_session", deviceId: null } };
    },
  };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gr_device" && current.deviceCookie ? { value: current.deviceCookie } : undefined,
  }),
  headers: async () => new Headers({ "user-agent": current.userAgent }),
}));

async function load() {
  const [subscriptions, subscribeRoute, devicesRoute, sweep, store, db] = await Promise.all([
    import("../../apps/web/src/server/push/subscriptions"),
    import("../../apps/web/src/app/api/push/subscribe/route"),
    import("../../apps/web/src/app/api/push/devices/route"),
    import("../../apps/web/src/server/auth/sweep"),
    import("../../apps/realtime/src/prisma-store"),
    import("@gistroom/db"),
  ]);
  return { ...subscriptions, subscribeRoute, devicesRoute, ...sweep, store, db: db.getDb() };
}

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms);
const keys = { p256dh: "p256dh-key", auth: "auth-key" };

describe.skipIf(!requireTestDb())("push subscriptions", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
    current.user = null;
    current.deviceCookie = undefined;
    current.userAgent = CHROME_WINDOWS;
  });
  afterAll(async () => {
    await resetTestDb();
  });

  async function person(key: string) {
    return m.db.user.create({
      data: {
        email: `test_push_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_push_${key}`,
        onboardedAt: new Date(),
      },
    });
  }
  const sub = (userId: string, endpoint: string, over: Record<string, unknown> = {}) =>
    m.db.pushSubscription.create({ data: { userId, endpoint, ...keys, ...over } });

  type Call = { method: string; path?: string; body?: unknown; origin?: string | null };
  async function call(
    route: "subscribeRoute" | "devicesRoute",
    { method, path, body, origin }: Call,
  ) {
    const handler = (
      m[route] as unknown as Record<string, (r: Request, c: unknown) => Promise<Response>>
    )[method];
    if (!handler) throw new Error(`no ${method}`);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (origin !== null) headers.origin = origin ?? WEB_ORIGIN;
    const res = await handler(
      new Request(`${WEB_ORIGIN}/api/push/x${path ?? ""}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      { params: Promise.resolve({}) },
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  // ---------- Saving a subscription ----------

  it("saves a subscription with a plain device name and the device it belongs to", async () => {
    const ada = await person("ada");
    await m.saveSubscription(
      ada,
      { endpoint: "https://push.example/1", ...keys },
      { deviceId: "dev_1", userAgent: CHROME_WINDOWS },
    );
    const row = await m.db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: "https://push.example/1" },
    });
    expect(row).toMatchObject({
      userId: ada.id,
      p256dh: keys.p256dh,
      deviceId: "dev_1",
      deviceLabel: "Chrome on Windows",
      failureCount: 0,
      revokedAt: null,
    });
  });

  it("cuts a very long user agent", async () => {
    const ada = await person("ada");
    await m.saveSubscription(
      ada,
      { endpoint: "https://push.example/long", ...keys },
      { deviceId: null, userAgent: "x".repeat(2000) },
    );
    const row = await m.db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: "https://push.example/long" },
    });
    expect(row.userAgent).toHaveLength(300);
  });

  it("brings a dead subscription back to life when the browser subscribes again", async () => {
    const ada = await person("ada");
    await sub(ada.id, "https://push.example/2", {
      revokedAt: ago(DAY),
      failureCount: 5,
      needsReauth: true,
      sessionEndedAt: ago(40 * DAY),
      unhealthyAt: ago(DAY),
      unhealthySeenAt: ago(DAY),
    });
    await m.saveSubscription(
      ada,
      { endpoint: "https://push.example/2", p256dh: "new-key", auth: "new-auth" },
      { deviceId: null, userAgent: CHROME_WINDOWS },
    );
    const row = await m.db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: "https://push.example/2" },
    });
    expect(row).toMatchObject({
      p256dh: "new-key",
      auth: "new-auth",
      revokedAt: null,
      failureCount: 0,
      needsReauth: false,
      sessionEndedAt: null,
      unhealthyAt: null,
      unhealthySeenAt: null,
    });
  });

  it("moves a browser to the person signing in now, so alerts never reach the person before", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    await m.saveSubscription(
      ada,
      { endpoint: "https://push.example/shared", ...keys },
      { deviceId: "dev_1", userAgent: CHROME_WINDOWS },
    );
    await m.saveSubscription(
      bayo,
      { endpoint: "https://push.example/shared", ...keys },
      { deviceId: "dev_1", userAgent: CHROME_WINDOWS },
    );
    const rows = await m.db.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(bayo.id);
  });

  // ---------- The subscribe and unsubscribe routes ----------

  it("saves through the route for the signed in person, with the device cookie", async () => {
    const ada = await person("ada");
    current.user = ada;
    current.deviceCookie = "0123456789abcdef0123456789abcdef";
    const res = await call("subscribeRoute", {
      method: "POST",
      body: { endpoint: "https://push.example/route", keys },
    });
    expect(res.status).toBe(200);
    const row = await m.db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: "https://push.example/route" },
    });
    expect(row.userId).toBe(ada.id);
    expect(row.deviceLabel).toBe("Chrome on Windows");
  });

  it("refuses a bad subscription, another origin and a person who is not signed in", async () => {
    const ada = await person("ada");
    const good = { endpoint: "https://push.example/ok", keys };
    current.user = ada;
    const bad = [
      { endpoint: "not a url", keys },
      { endpoint: `https://push.example/${"a".repeat(1100)}`, keys },
      { endpoint: "https://push.example/ok", keys: { p256dh: "", auth: "x" } },
      { endpoint: "https://push.example/ok", keys: { p256dh: "x".repeat(300), auth: "x" } },
      { endpoint: "https://push.example/ok" },
      {},
    ];
    for (const body of bad) {
      expect((await call("subscribeRoute", { method: "POST", body })).status).toBe(400);
    }
    expect(
      (await call("subscribeRoute", { method: "POST", body: good, origin: "https://evil.example" }))
        .status,
    ).toBe(403);
    expect(
      (await call("subscribeRoute", { method: "POST", body: good, origin: null })).status,
    ).toBe(403);
    current.user = null;
    expect((await call("subscribeRoute", { method: "POST", body: good })).status).toBe(401);
    expect(await m.db.pushSubscription.count()).toBe(0);
  });

  it("removes only your own subscription when you turn alerts off", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    await sub(ada.id, "https://push.example/ada");
    await sub(bayo.id, "https://push.example/bayo");
    current.user = ada;
    // Another person's endpoint is not removed, and the answer does not give that away.
    expect(
      (
        await call("subscribeRoute", {
          method: "DELETE",
          body: { endpoint: "https://push.example/bayo" },
        })
      ).status,
    ).toBe(200);
    expect(await m.db.pushSubscription.count()).toBe(2);
    await call("subscribeRoute", {
      method: "DELETE",
      body: { endpoint: "https://push.example/ada" },
    });
    const left = await m.db.pushSubscription.findMany();
    expect(left.map((r) => r.userId)).toEqual([bayo.id]);
    expect(
      (await call("subscribeRoute", { method: "DELETE", body: { endpoint: "nope" } })).status,
    ).toBe(400);
  });

  // ---------- The devices list ----------

  it("lists only your own live devices, marks this one, and removes one by id for you only", async () => {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const mine = await sub(ada.id, "https://push.example/a1", {
      deviceId: "dev_a",
      deviceLabel: "Chrome on Windows",
      lastSuccessAt: ago(DAY),
    });
    await sub(ada.id, "https://push.example/a2", { deviceId: "dev_b", revokedAt: ago(DAY) });
    const theirs = await sub(bayo.id, "https://push.example/b1", { deviceId: "dev_c" });
    current.user = ada;
    current.deviceCookie = "dev_a";

    const list = await call("devicesRoute", { method: "GET" });
    const devices = list.body.devices as { id: string; current: boolean; label: string }[];
    expect(devices.map((d) => d.id)).toEqual([mine.id]);
    expect(devices[0]).toMatchObject({ current: true, label: "Chrome on Windows" });
    // Nothing in the list exposes the endpoint or the keys.
    expect(JSON.stringify(list.body)).not.toContain("push.example");
    expect(JSON.stringify(list.body)).not.toContain(keys.p256dh);

    await call("devicesRoute", { method: "DELETE", path: `?id=${theirs.id}` });
    expect(await m.db.pushSubscription.count({ where: { id: theirs.id } })).toBe(1);
    await call("devicesRoute", { method: "DELETE", path: `?id=${mine.id}` });
    expect(await m.db.pushSubscription.count({ where: { id: mine.id } })).toBe(0);
  });

  it("marks an unhealthy device as seen once the person has been told", async () => {
    const ada = await person("ada");
    const row = await sub(ada.id, "https://push.example/sick", { unhealthyAt: ago(1000) });
    current.user = ada;
    let list = await call("devicesRoute", { method: "GET" });
    expect((list.body.devices as { notice: boolean }[])[0]?.notice).toBe(true);
    await call("devicesRoute", { method: "POST" });
    list = await call("devicesRoute", { method: "GET" });
    expect((list.body.devices as { notice: boolean }[])[0]?.notice).toBe(false);
    expect(
      (await m.db.pushSubscription.findUniqueOrThrow({ where: { id: row.id } })).unhealthySeenAt,
    ).not.toBeNull();
  });

  // ---------- Clean up ----------

  it("sweeps subscriptions that have not delivered for 90 days and ones revoked over a week ago", async () => {
    const ada = await person("ada");
    await sub(ada.id, "https://push.example/fresh", { lastSuccessAt: ago(DAY) });
    await sub(ada.id, "https://push.example/new-never", { createdAt: ago(DAY) });
    await sub(ada.id, "https://push.example/revoked-lately", {
      revokedAt: ago(2 * DAY),
      lastSuccessAt: ago(DAY),
    });
    await sub(ada.id, "https://push.example/stale", { lastSuccessAt: ago(91 * DAY) });
    await sub(ada.id, "https://push.example/never", { createdAt: ago(91 * DAY) });
    await sub(ada.id, "https://push.example/revoked-long", {
      revokedAt: ago(8 * DAY),
      lastSuccessAt: ago(DAY),
    });
    expect(await m.sweepSubscriptions()).toBe(3);
    const left = await m.db.pushSubscription.findMany({ orderBy: { endpoint: "asc" } });
    expect(left.map((r) => r.endpoint)).toEqual([
      "https://push.example/fresh",
      "https://push.example/new-never",
      "https://push.example/revoked-lately",
    ]);
  });

  // ---------- What happens after a send ----------

  it("records delivery results: success resets, three failures flag the device, 410 revokes", async () => {
    const ada = await person("ada");
    const row = await sub(ada.id, "https://push.example/result", { failureCount: 2 });
    const store = m.store.createPrismaStore();
    const read = () => m.db.pushSubscription.findUniqueOrThrow({ where: { id: row.id } });

    await store.recordPushResult({ subscriptionId: row.id, ok: true, revoke: false });
    expect(await read()).toMatchObject({ failureCount: 0, unhealthyAt: null });
    expect((await read()).lastSuccessAt).not.toBeNull();

    await store.recordPushResult({ subscriptionId: row.id, ok: false, revoke: false });
    await store.recordPushResult({ subscriptionId: row.id, ok: false, revoke: false });
    expect(await read()).toMatchObject({ failureCount: 2, unhealthyAt: null, revokedAt: null });
    await store.recordPushResult({ subscriptionId: row.id, ok: false, revoke: false });
    const flagged = await read();
    expect(flagged.failureCount).toBe(3);
    expect(flagged.unhealthyAt).not.toBeNull();
    expect(flagged.revokedAt).toBeNull();

    // A good delivery clears the flag, and a gone endpoint (404 or 410) is revoked at once.
    await store.recordPushResult({ subscriptionId: row.id, ok: true, revoke: false });
    expect(await read()).toMatchObject({ failureCount: 0, unhealthyAt: null });
    await store.recordPushResult({ subscriptionId: row.id, ok: false, revoke: true });
    expect((await read()).revokedAt).not.toBeNull();
    // A revoked subscription is no longer used for alerts.
    expect(await store.subscriptionById(row.id)).toMatchObject({ id: row.id });
    expect(await m.db.pushSubscription.count({ where: { userId: ada.id, revokedAt: null } })).toBe(
      0,
    );
  });
});
