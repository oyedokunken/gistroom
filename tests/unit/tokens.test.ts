import { describe, expect, it } from "vitest";
import {
  hashToken,
  isAllowedOrigin,
  newSessionToken,
  sessionCookieAttributes,
  sessionExpiry,
  shouldSlide,
  signRealtimePass,
  verifyRealtimePass,
} from "../../apps/web/src/server/auth/tokens";

const secret = "s".repeat(40);
const now = new Date("2026-10-10T10:00:00Z");

describe("session tokens", () => {
  it("are long, unique and hashed to a fixed length", () => {
    const a = newSessionToken();
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a).not.toBe(newSessionToken());
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });
  it("expire after 30 days and slide at most once a day", () => {
    expect(sessionExpiry(now).getTime() - now.getTime()).toBe(30 * 86_400_000);
    expect(shouldSlide(new Date(now.getTime() - 3_600_000), now)).toBe(false);
    expect(shouldSlide(new Date(now.getTime() - 90_000_000), now)).toBe(true);
  });
  it("set the cookie attributes from the spec", () => {
    const attrs = sessionCookieAttributes({ secure: true });
    for (const part of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
      expect(attrs).toContain(part);
    expect(sessionCookieAttributes({ secure: false })).not.toContain("Secure");
  });
});

describe("realtime pass", () => {
  const pass = { userId: "u1", sessionId: "s1" };

  it("round trips", () => {
    const token = signRealtimePass(pass, secret, now);
    expect(verifyRealtimePass(token, secret, now)).toEqual({ ok: true, pass });
  });
  it("expires after 15 minutes", () => {
    const token = signRealtimePass(pass, secret, now);
    expect(verifyRealtimePass(token, secret, new Date(now.getTime() + 14 * 60_000)).ok).toBe(true);
    expect(verifyRealtimePass(token, secret, new Date(now.getTime() + 15 * 60_000))).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
  });
  it("rejects a wrong secret and a tampered payload", () => {
    const token = signRealtimePass(pass, secret, now);
    expect(verifyRealtimePass(token, "x".repeat(40), now)).toEqual({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ userId: "admin", sessionId: "s1", exp: 9e9, aud: "gistroom-realtime" }),
    ).toString("base64url");
    expect(verifyRealtimePass(`${h}.${forged}.${s}`, secret, now)).toEqual({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
  });
  it("rejects the none algorithm and malformed tokens", () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from("{}").toString("base64url")}.`;
    expect(verifyRealtimePass(none, secret, now).ok).toBe(false);
    expect(verifyRealtimePass("nonsense", secret, now)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});

describe("origin check", () => {
  it("only accepts the app origin", () => {
    expect(isAllowedOrigin("https://gistroom.ng", "https://gistroom.ng")).toBe(true);
    expect(isAllowedOrigin("https://evil.example", "https://gistroom.ng")).toBe(false);
    expect(isAllowedOrigin(null, "https://gistroom.ng")).toBe(false);
    expect(isAllowedOrigin("not a url", "https://gistroom.ng")).toBe(false);
  });
});
