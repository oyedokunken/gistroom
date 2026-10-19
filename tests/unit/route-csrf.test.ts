import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../apps/web/src/server/http";
import { resetEnvCache } from "../../apps/web/src/server/env";

const API_ROOT = path.join(import.meta.dirname, "..", "..", "apps", "web", "src", "app", "api");
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;

/** Routes that may skip the browser origin check, each with the credential it checks instead. */
const CSRF_NONE: Record<string, string> = {
  "internal/jobs/sweep/route.ts": "bearer secret (INTERNAL_SERVICE_TOKEN or CRON_SECRET)",
  "livekit/webhook/route.ts": "LiveKit signed Authorization header",
};

/** Mutating routes that are deliberately not wrapped in api(). */
const NOT_WRAPPED: Record<string, string> = {
  "csp-report/route.ts":
    "browsers post CSP reports without a session and the route only counts and drops them, so there is nothing to forge",
};

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? routeFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

const routes = routeFiles(API_ROOT)
  .filter((file) => path.basename(file) === "route.ts")
  .map((file) => ({
    rel: path.relative(API_ROOT, file).split(path.sep).join("/"),
    source: readFileSync(file, "utf8"),
  }));

function mutatingExports(source: string): string[] {
  return MUTATING.filter((method) =>
    new RegExp(`export\\s+(const|async\\s+function|function)\\s+${method}\\b`).test(source),
  );
}

describe("every mutating route is protected by the same-origin check", () => {
  it("finds the route handlers", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it("wraps every mutating handler in api() unless it is on the short allow-list", () => {
    const offenders: string[] = [];
    for (const { rel, source } of routes) {
      for (const method of mutatingExports(source)) {
        const wrapped = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*api\\(`).test(source);
        if (!wrapped && !(rel in NOT_WRAPPED)) offenders.push(`${rel} ${method}`);
      }
    }
    expect(offenders, "wrap the handler in api() so the origin check runs").toEqual([]);
  });

  it("lets only the allow-listed routes opt out with csrf: none", () => {
    const optedOut = routes
      .filter(({ source }) => /csrf:\s*"none"/.test(source))
      .map(({ rel }) => rel)
      .sort();
    expect(optedOut).toEqual(Object.keys(CSRF_NONE).sort());
  });

  it("keeps the allow-lists short and pointing at real files", () => {
    expect(Object.keys(CSRF_NONE).length).toBeLessThanOrEqual(2);
    expect(Object.keys(NOT_WRAPPED).length).toBeLessThanOrEqual(1);
    for (const rel of [...Object.keys(CSRF_NONE), ...Object.keys(NOT_WRAPPED)]) {
      expect(
        routes.some((r) => r.rel === rel),
        `${rel} no longer exists`,
      ).toBe(true);
    }
  });

  it("does not call assertSameOrigin from a route, because api() does it", () => {
    const offenders = routes.filter(({ source }) => source.includes("assertSameOrigin"));
    expect(offenders.map((r) => r.rel)).toEqual([]);
  });
});

describe("api() same-origin check", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://gistroom.ng");
  });
  afterEach(() => vi.unstubAllEnvs());

  const ok = api(async () => Response.json({ ran: true }));
  const send = (method: string, headers: Record<string, string> = {}) =>
    ok(new Request("https://gistroom.ng/api/x", { method, headers }));

  it("refuses a mutation from another origin, with no body", async () => {
    for (const method of MUTATING) {
      const res = await send(method, { origin: "https://evil.example" });
      expect(res.status, method).toBe(403);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("ORIGIN");
    }
  });

  it("refuses a mutation with no Origin header", async () => {
    for (const method of MUTATING) expect((await send(method)).status, method).toBe(403);
  });

  it("refuses a browser request marked cross-site even when the Origin matches", async () => {
    const res = await send("POST", {
      origin: "https://gistroom.ng",
      "sec-fetch-site": "cross-site",
    });
    expect(res.status).toBe(403);
  });

  it("accepts the own origin", async () => {
    for (const method of MUTATING) {
      const res = await send(method, {
        origin: "https://gistroom.ng",
        "sec-fetch-site": "same-origin",
      });
      expect(res.status, method).toBe(200);
    }
  });

  it("never checks reads", async () => {
    expect((await send("GET")).status).toBe(200);
  });

  it("skips the check only when a route opts out", async () => {
    const open = api(async () => Response.json({ ran: true }), { csrf: "none" });
    const res = await open(new Request("https://gistroom.ng/api/x", { method: "POST" }));
    expect(res.status).toBe(200);
  });
});

type Handler = (
  request: Request,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

async function load(rel: string): Promise<Record<string, Handler>> {
  return (await import(/* @vite-ignore */ `../../apps/web/src/app/api/${rel}`)) as Record<
    string,
    Handler
  >;
}

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

describe("real routes refuse cross-origin and missing-Origin mutations", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://gistroom.ng");
  });
  afterEach(() => vi.unstubAllEnvs());

  const cases: [string, string, Record<string, string>][] = [
    ["calls/[id]/heartbeat/route", "POST", { id: "c1" }],
    ["rooms/[slug]/heartbeat/route", "POST", { slug: "s1" }],
    ["calls/[id]/end/route", "POST", { id: "c1" }],
    ["friends/requests/route", "POST", {}],
    ["sessions/revoke-others/route", "POST", {}],
    ["notifications/route", "DELETE", {}],
    ["messages/[id]/route", "DELETE", { id: "m1" }],
    ["push/subscribe/route", "POST", {}],
  ];

  for (const [rel, method, params] of cases) {
    it(`${rel} ${method}`, async () => {
      const handler = (await load(rel))[method];
      if (!handler) throw new Error(`${rel} has no ${method}`);
      const url = "https://gistroom.ng/api/x";
      const cross = await handler(
        new Request(url, { method, headers: { origin: "https://evil.example" } }),
        ctx(params),
      );
      expect(cross.status).toBe(403);
      const missing = await handler(new Request(url, { method }), ctx(params));
      expect(missing.status).toBe(403);
    }, 60_000);
  }
});

describe("routes that opt out verify their own credential", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://gistroom.ng");
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/none");
    vi.stubEnv("DIRECT_URL", "postgresql://u:p@localhost:5432/none");
    vi.stubEnv("DATABASE_SCHEMA", "gistroom_test");
    vi.stubEnv("INTERNAL_SERVICE_TOKEN", "i".repeat(40));
    vi.stubEnv("CRON_SECRET", "c".repeat(24));
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    vi.stubEnv("REALTIME_PASS_SECRET", "r".repeat(40));
    vi.stubEnv("LIVEKIT_API_KEY", "key");
    vi.stubEnv("LIVEKIT_API_SECRET", "secret-secret-secret-secret-secret-1234");
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("the sweep rejects a call with no secret, a wrong secret and a cross-origin one", async () => {
    const { POST } = await load("internal/jobs/sweep/route");
    const post = (headers: Record<string, string> = {}) =>
      POST!(
        new Request("https://gistroom.ng/api/internal/jobs/sweep", { method: "POST", headers }),
        ctx({}),
      );
    expect((await post()).status).toBe(401);
    expect((await post({ authorization: "Bearer wrong" })).status).toBe(401);
    expect((await post({ origin: "https://evil.example" })).status).toBe(401);
  }, 60_000);

  it("the LiveKit webhook rejects an unsigned and a wrongly signed delivery", async () => {
    const { POST } = await load("livekit/webhook/route");
    const post = (headers: Record<string, string> = {}) =>
      POST!(
        new Request("https://gistroom.ng/api/livekit/webhook", {
          method: "POST",
          headers,
          body: JSON.stringify({ id: "e1", event: "room_finished", room: { name: "room_x" } }),
        }),
        ctx({}),
      );
    expect((await post()).status).toBe(401);
    expect((await post({ authorization: "not.a.token" })).status).toBe(401);
  }, 60_000);
});
