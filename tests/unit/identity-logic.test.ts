import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkText } from "../../scripts/lib/copy-rules.mjs";
import { errors } from "../../packages/shared/src";
import { deviceLabel } from "../../apps/web/src/lib/device-label";
import {
  decodeCursor,
  dmKeyFor,
  encodeCursor,
  escapeLike,
  orderedPair,
} from "../../apps/web/src/server/cursor";
import { relationshipFor } from "../../apps/web/src/server/friends/relations";
import {
  mockCode,
  mockIdentity,
  newOAuthState,
  openState,
  pkcePair,
  resolveGoogleAction,
  safeNext,
  sealState,
} from "../../apps/web/src/server/auth/google";
import { decide, policies, windowStart } from "../../apps/web/src/server/rate-limit";
import { isUniqueViolation } from "../../apps/web/src/server/db-errors";

const secret = "g".repeat(40);

describe("rate limit windows", () => {
  const now = new Date("2026-10-10T10:07:30Z");
  it("aligns fixed windows", () => {
    expect(windowStart(now, 60).toISOString()).toBe("2026-10-10T10:07:00.000Z");
    expect(windowStart(now, 3600).toISOString()).toBe("2026-10-10T10:00:00.000Z");
  });
  it("allows up to the limit and then reports when the window resets", () => {
    const p = policies.peopleSearch;
    expect(decide(30, p, now)).toEqual({ allowed: true, remaining: 0, retryAfterSec: 0 });
    expect(decide(31, p, now)).toEqual({ allowed: false, remaining: 0, retryAfterSec: 30 });
  });
  it("matches the limits in the spec", () => {
    expect(policies.otpSendIp.limit).toBe(20);
    expect(policies.peopleSearch.limit).toBe(30);
    expect(policies.friendRequestHour.limit).toBe(10);
    expect(policies.friendRequestDay.limit).toBe(30);
    expect(policies.messages.limit).toBe(60);
    expect(policies.roomCreate.limit).toBe(10);
    expect(policies.callStart.limit).toBe(10);
    expect(policies.contact.limit).toBe(5);
  });
});

describe("google oauth helpers", () => {
  it("makes an S256 PKCE pair", () => {
    const { verifier, challenge } = pkcePair();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });
  it("seals and opens state, rejecting tampering and expiry", () => {
    const { state } = newOAuthState("/app/chats", new Date("2026-10-10T10:00:00Z"));
    const sealed = sealState(state, secret);
    expect(openState(sealed, secret, new Date("2026-10-10T10:05:00Z"))).toEqual(state);
    expect(openState(sealed, secret, new Date("2026-10-10T10:11:00Z"))).toBeNull();
    expect(openState(sealed, "x".repeat(40), new Date("2026-10-10T10:01:00Z"))).toBeNull();
    const [body] = sealed.split(".");
    expect(openState(`${body}.AAAA`, secret, new Date("2026-10-10T10:01:00Z"))).toBeNull();
    expect(openState("garbage", secret)).toBeNull();
  });
  it("only follows same site next paths", () => {
    expect(safeNext("/app/rooms?x=1")).toBe("/app/rooms?x=1");
    for (const bad of [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(safeNext(bad as string | null | undefined)).toBe("/app/chats");
    }
  });
  it("round trips a mock identity and rejects junk", () => {
    const id = mockIdentity(mockCode("Kenny@Example.com"));
    expect(id).toMatchObject({ email: "kenny@example.com", emailVerified: true });
    expect(id?.sub).toMatch(/^mock-/);
    expect(mockIdentity("real-code")).toBeNull();
    expect(mockIdentity("mock:bm90YW5lbWFpbA")).toBeNull();
  });
  it("decides sign in, link, create and refuse", () => {
    const base = { emailVerified: true, accountExists: false, emailUserExists: false };
    expect(resolveGoogleAction(base)).toBe("CREATE");
    expect(resolveGoogleAction({ ...base, emailUserExists: true })).toBe("LINK");
    expect(resolveGoogleAction({ ...base, accountExists: true })).toBe("SIGN_IN");
    expect(resolveGoogleAction({ ...base, emailVerified: false, accountExists: true })).toBe(
      "REFUSE_UNVERIFIED",
    );
  });
});

describe("cursors and pairs", () => {
  const guard = (v: unknown): v is { a: number } =>
    typeof v === "object" && v !== null && typeof (v as { a: unknown }).a === "number";
  it("round trip and reject garbage", () => {
    expect(decodeCursor(encodeCursor({ a: 1 }), guard)).toEqual({ a: 1 });
    expect(decodeCursor("not base64 json", guard)).toBeNull();
    expect(decodeCursor(encodeCursor({ a: "x" }), guard)).toBeNull();
    expect(decodeCursor(null, guard)).toBeNull();
  });
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
  it("orders pairs the same both ways", () => {
    expect(orderedPair("b", "a")).toEqual({ low: "a", high: "b" });
    expect(dmKeyFor("b", "a")).toBe(dmKeyFor("a", "b"));
    expect(dmKeyFor("a", "b")).toBe("a:b");
  });
});

describe("relationshipFor", () => {
  const none = {
    isFriend: false,
    blocked: false,
    sentPending: false,
    receivedPending: false,
    cooldownActive: false,
  };
  it("maps every state and lets blocks win", () => {
    expect(relationshipFor(none)).toBe("NONE");
    expect(relationshipFor({ ...none, isFriend: true })).toBe("FRIENDS");
    expect(relationshipFor({ ...none, sentPending: true })).toBe("REQUEST_SENT");
    expect(relationshipFor({ ...none, receivedPending: true })).toBe("REQUEST_RECEIVED");
    expect(relationshipFor({ ...none, cooldownActive: true })).toBe("UNAVAILABLE");
    expect(relationshipFor({ ...none, isFriend: true, blocked: true })).toBe("UNAVAILABLE");
  });
});

describe("device label", () => {
  it("names common browsers and systems", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      ),
    ).toBe("Chrome on Windows");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115 Mobile Safari/537.36",
      ),
    ).toBe("Samsung Internet on Android");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iOS");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120",
      ),
    ).toBe("Edge on Windows");
    expect(deviceLabel("")).toBe("Browser on an unknown device");
  });
});

describe("unique violation detection", () => {
  it("reads Prisma P2002 shapes", () => {
    expect(isUniqueViolation({ code: "P2002", meta: { target: ["username"] } }, "username")).toBe(
      true,
    );
    expect(isUniqueViolation({ code: "P2002", meta: { target: ["email"] } }, "username")).toBe(
      false,
    );
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});

describe("api messages follow the voice rules", () => {
  it("pass the copy linter, never apologize and avoid vague phrases", () => {
    const samples = Object.values(errors).map((v) => (typeof v === "function" ? v(3) : v));
    for (const text of samples) {
      expect(checkText(text)).toEqual([]);
      expect(text.toLowerCase()).not.toMatch(/sorry|something went wrong|oops/);
    }
  });
});
