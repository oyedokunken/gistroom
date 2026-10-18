import { afterEach, describe, expect, it, vi } from "vitest";

// The async helper reads the request headers from Next. Here they come from a variable the tests set.
const incoming = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => incoming.headers,
  cookies: async () => ({ get: () => undefined }),
}));

import {
  UNTRUSTED_CLIENT,
  clientIp,
  clientIpFrom,
  trustsForwardedHeaders,
} from "../../apps/web/src/server/http";

const forged = new Headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "7.7.7.7" });

describe("which proxies are trusted", () => {
  it("trusts nothing by default", () => {
    expect(trustsForwardedHeaders({})).toBe(false);
  });

  it("trusts Vercel, which always overwrites the forwarded header", () => {
    expect(trustsForwardedHeaders({ VERCEL: "1" })).toBe(true);
  });

  it("trusts another proxy only when TRUST_PROXY says so", () => {
    expect(trustsForwardedHeaders({ TRUST_PROXY: "true" })).toBe(true);
    expect(trustsForwardedHeaders({ TRUST_PROXY: "false" })).toBe(false);
    expect(trustsForwardedHeaders({ TRUST_PROXY: "yes" })).toBe(false);
  });

  it("lets TRUST_PROXY=false switch Vercel trust off", () => {
    expect(trustsForwardedHeaders({ VERCEL: "1", TRUST_PROXY: "false" })).toBe(false);
  });
});

describe("the address a limit is counted against", () => {
  it("ignores forwarded headers when no trusted proxy is in front, so a caller cannot pick a new identity", () => {
    expect(clientIpFrom(forged, {})).toBe(UNTRUSTED_CLIENT);
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "1.1.1.1" }), {})).toBe(UNTRUSTED_CLIENT);
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "2.2.2.2" }), {})).toBe(UNTRUSTED_CLIENT);
  });

  it("reads the first forwarded address behind a trusted proxy", () => {
    const env = { VERCEL: "1" };
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " 41.58.1.2 , 10.0.0.1" }), env)).toBe(
      "41.58.1.2",
    );
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "41.58.1.2" }), env)).toBe("41.58.1.2");
  });

  it("falls back to x-real-ip, then to a fixed key, behind a trusted proxy", () => {
    const env = { TRUST_PROXY: "true" };
    expect(clientIpFrom(new Headers({ "x-real-ip": "41.58.9.9" }), env)).toBe("41.58.9.9");
    expect(clientIpFrom(new Headers(), env)).toBe("unknown");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": " " }), env)).toBe("unknown");
  });
});

describe("clientIp() on a request", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    incoming.headers = new Headers();
  });

  it("does not trust a forged header outside a trusted platform", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY", "");
    incoming.headers = forged;
    expect(await clientIp()).toBe(UNTRUSTED_CLIENT);
  });

  it("uses the platform's header on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    incoming.headers = new Headers({ "x-forwarded-for": "102.89.4.4" });
    expect(await clientIp()).toBe("102.89.4.4");
  });
});
