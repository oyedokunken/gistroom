import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  LIMITS,
  isUnhealthy,
  plainPushPayload,
  withinPushGrace,
  buildPushPayload,
} from "../../packages/shared/src";
import { proxy } from "../../apps/web/src/proxy";
import {
  isDeviceId,
  sessionCookieAttributes,
  sessionExpiry,
  shouldSlide,
} from "../../apps/web/src/server/auth/tokens";

const DAY = 86_400_000;
const t0 = new Date("2026-10-13T08:00:00Z");

describe("session policy", () => {
  it("keeps people signed in for 30 days and never past 90", () => {
    expect(LIMITS.SESSION_DAYS).toBe(30);
    expect(LIMITS.SESSION_MAX_DAYS).toBe(90);
    expect(sessionExpiry(t0, t0).getTime() - t0.getTime()).toBe(30 * DAY);
    // At day 80 the sliding window would reach day 110, but the cap holds it at day 90.
    const day80 = new Date(t0.getTime() + 80 * DAY);
    expect(sessionExpiry(day80, t0).getTime() - t0.getTime()).toBe(90 * DAY);
  });

  it("writes the sliding expiry at most once a day", () => {
    expect(shouldSlide(new Date(t0.getTime() - 3_600_000), t0)).toBe(false);
    expect(shouldSlide(new Date(t0.getTime() - 23 * 3_600_000), t0)).toBe(false);
    expect(shouldSlide(new Date(t0.getTime() - 25 * 3_600_000), t0)).toBe(true);
  });

  it("describes the cookie with a 30 day Max-Age, httpOnly, Lax and Secure", () => {
    const attrs = sessionCookieAttributes({ secure: true });
    expect(attrs).toContain("Max-Age=2592000");
    expect(attrs).toContain("HttpOnly");
    expect(attrs).toContain("SameSite=Lax");
    expect(attrs).toContain("Secure");
    expect(attrs).toContain("Path=/");
  });

  it("accepts only long random device ids", () => {
    expect(isDeviceId("a".repeat(32))).toBe(true);
    expect(isDeviceId("short")).toBe(false);
    expect(isDeviceId("has spaces and ; semicolons ........")).toBe(false);
  });
});

describe("the proxy renews cookies on page loads", () => {
  const page = (cookie: string, headers: Record<string, string> = {}) =>
    new NextRequest("https://gistroom.ng/app/chats", {
      headers: { accept: "text/html", cookie, "x-forwarded-proto": "https", ...headers },
    });
  const setCookies = (res: Response) => res.headers.getSetCookie();

  it("re-issues the same session value with a fresh 30 day life, from the server", () => {
    const res = proxy(page("gr_session=tokenvalue123; gr_device=" + "d".repeat(30)));
    const session = setCookies(res).find((c) => c.startsWith("gr_session="));
    expect(session).toContain("gr_session=tokenvalue123");
    expect(session).toContain("Max-Age=2592000");
    expect(session?.toLowerCase()).toContain("httponly");
    expect(session?.toLowerCase()).toContain("secure");
    expect(session?.toLowerCase()).toContain("samesite=lax");
    expect(session).toContain("Expires=");
    const device = setCookies(res).find((c) => c.startsWith("gr_device="));
    expect(device).toContain("Max-Age=31536000");
  });

  it("gives parallel requests the same value, so a renewal can never log anyone out", () => {
    const values = Array.from({ length: 10 }, () =>
      setCookies(proxy(page("gr_session=stable-token-value"))).find((c) =>
        c.startsWith("gr_session="),
      ),
    ).map((c) => c?.split(";")[0]);
    expect(new Set(values).size).toBe(1);
    expect(values[0]).toBe("gr_session=stable-token-value");
  });

  it("does nothing without a session cookie or for API calls", () => {
    expect(setCookies(proxy(page("other=1")))).toEqual([]);
    const api = new NextRequest("https://gistroom.ng/api/x", {
      headers: { accept: "application/json", cookie: "gr_session=abc" },
    });
    expect(setCookies(proxy(api))).toEqual([]);
  });
});

describe("alerts after the session ends", () => {
  const full = (
    type: Parameters<typeof buildPushPayload>[0]["type"],
    title: string,
    body: string,
  ) =>
    buildPushPayload({
      type,
      title,
      body,
      url: "/app/chats/c1",
      ref: "r1",
      previews: true,
      badge: 3,
      data: { callId: "call1", notificationId: "n1", fromName: "Ada" },
    });

  it("says nothing about who or what, but still opens the right place", () => {
    const msg = plainPushPayload(full("DM_MESSAGE", "Ada", "Are you coming tonight?"));
    expect(msg.title).toBe("Gistroom");
    expect(msg.body).toBe("You have a new message");
    expect(JSON.stringify(msg)).not.toContain("Ada");
    expect(msg.url).toBe("/app/chats/c1");
    expect(msg.tag).toBe("dm:r1");
    expect(msg.data).toEqual({ callId: "call1", notificationId: "n1" });
  });

  it("uses fixed words for calls, missed calls and invites", () => {
    expect(plainPushPayload(full("CALL_INCOMING", "Ada is calling", "Audio call")).body).toBe(
      "Incoming call. Open Gistroom to sign in and answer.",
    );
    expect(plainPushPayload(full("CALL_CANCEL", "Missed call", "Missed call from Ada.")).body).toBe(
      "You have a missed call",
    );
    expect(plainPushPayload(full("ROOM_INVITE", "Room invite", "Ada invited you")).body).toBe(
      "You have a room invite",
    );
  });

  it("keeps the grace period at 30 days and marks a device unhealthy after 3 failures", () => {
    expect(withinPushGrace(new Date(t0.getTime() - 20 * DAY), t0, LIMITS.PUSH_GRACE_DAYS)).toBe(
      true,
    );
    expect(withinPushGrace(new Date(t0.getTime() - 31 * DAY), t0, LIMITS.PUSH_GRACE_DAYS)).toBe(
      false,
    );
    expect(isUnhealthy(2)).toBe(false);
    expect(isUnhealthy(3)).toBe(true);
  });
});
