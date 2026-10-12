import { describe, expect, it } from "vitest";
import {
  GENERIC_BODY,
  NOTIFICATION_TYPES,
  PUSH_MAX_BYTES,
  PUSH_POLICY,
  buildPushPayload,
  channelsFor,
  defaultPrefs,
  defaultSwitches,
  deliveryPlan,
  inQuietHours,
  notificationHref,
  pushTag,
  receiptStatus,
  advanceCursor,
  shouldRevoke,
} from "../../packages/shared/src";

describe("push policy", () => {
  it("matches the TTL and urgency table", () => {
    expect(PUSH_POLICY.CALL_INCOMING).toEqual({
      ttlSec: 45,
      urgency: "high",
      requireInteraction: true,
    });
    expect(PUSH_POLICY.CALL_CANCEL.ttlSec).toBe(45);
    expect(PUSH_POLICY.DM_MESSAGE.ttlSec).toBe(24 * 3600);
    expect(PUSH_POLICY.FRIEND_REQUEST.ttlSec).toBe(7 * 24 * 3600);
    expect(PUSH_POLICY.ROOM_INVITE.ttlSec).toBe(3600);
    expect(PUSH_POLICY.ROOM_STARTING).toMatchObject({ ttlSec: 900, urgency: "high" });
    expect(PUSH_POLICY.SECURITY_NEW_DEVICE.urgency).toBe("high");
  });
  it("builds collapse tags per kind", () => {
    expect(pushTag("CALL_INCOMING", "c1")).toBe("call:c1");
    expect(pushTag("CALL_CANCEL", "c1")).toBe("call:c1");
    expect(pushTag("DM_MESSAGE", "k1")).toBe("dm:k1");
    expect(pushTag("FRIEND_REQUEST", "r1")).toBe("fr:r1");
    expect(pushTag("ROOM_INVITE", "x")).toBe("room:x");
    expect(pushTag("ROOM_STARTING", "x")).toBe("roomstart:x");
    expect(pushTag("SECURITY_NEW_DEVICE", "s")).toBe("sec:s");
  });
});

describe("buildPushPayload", () => {
  const base = {
    type: "DM_MESSAGE" as const,
    title: "Ada",
    body: "Are you coming tonight?",
    url: "/app/chats/k1",
    ref: "k1",
    badge: 3,
  };
  it("keeps the body when previews are on", () => {
    expect(buildPushPayload({ ...base, previews: true }).body).toBe("Are you coming tonight?");
  });
  it("uses a generic body when previews are off, except for calls", () => {
    expect(buildPushPayload({ ...base, previews: false }).body).toBe(GENERIC_BODY);
    expect(
      buildPushPayload({ ...base, type: "CALL_INCOMING", body: "Audio call", previews: false })
        .body,
    ).toBe("Audio call");
  });
  it("stays under 4 KB even for huge input", () => {
    const p = buildPushPayload({
      ...base,
      title: "x".repeat(5000),
      body: "y".repeat(9000),
      previews: true,
    });
    expect(JSON.stringify(p).length).toBeLessThan(PUSH_MAX_BYTES);
  });
});

describe("delivery plan", () => {
  it("skips push when a focused socket exists, except for calls", () => {
    expect(deliveryPlan({ hasFocusedSocket: true, kind: "DM_MESSAGE" })).toEqual({
      socket: true,
      push: false,
    });
    expect(deliveryPlan({ hasFocusedSocket: false, kind: "DM_MESSAGE" })).toEqual({
      socket: false,
      push: true,
    });
    expect(deliveryPlan({ hasFocusedSocket: true, kind: "CALL_INCOMING" })).toEqual({
      socket: true,
      push: true,
    });
    expect(deliveryPlan({ hasFocusedSocket: false, kind: "CALL_INCOMING" }).push).toBe(true);
  });
});

describe("subscription lifecycle", () => {
  it("revokes on 404 and 410 and after repeated failures", () => {
    expect(shouldRevoke({ statusCode: 404, failureCount: 0 })).toBe(true);
    expect(shouldRevoke({ statusCode: 410, failureCount: 0 })).toBe(true);
    expect(shouldRevoke({ statusCode: 500, failureCount: 4 })).toBe(false);
    expect(shouldRevoke({ statusCode: 500, failureCount: 5 })).toBe(true);
    expect(shouldRevoke({ statusCode: null, failureCount: 1 })).toBe(false);
  });
});

describe("quiet hours", () => {
  // 21:30 UTC is 22:30 in Lagos (UTC+1).
  const night = new Date("2026-10-10T21:30:00Z");
  it("handles a window that wraps past midnight in the person's zone", () => {
    expect(inQuietHours(night, "Africa/Lagos", "22:00", "07:00")).toBe(true);
    expect(inQuietHours(night, "UTC", "22:00", "07:00")).toBe(false);
    expect(inQuietHours(new Date("2026-10-10T12:00:00Z"), "Africa/Lagos", "22:00", "07:00")).toBe(
      false,
    );
    expect(inQuietHours(new Date("2026-10-10T05:59:00Z"), "Africa/Lagos", "22:00", "07:00")).toBe(
      true,
    );
  });
  it("treats a missing or empty window as off", () => {
    expect(inQuietHours(night, "Africa/Lagos", null, null)).toBe(false);
    expect(inQuietHours(night, "Africa/Lagos", "22:00", "22:00")).toBe(false);
  });
  it("silences push and email but keeps the in app list", () => {
    const prefs = { ...defaultPrefs, quietStart: "22:00", quietEnd: "07:00" };
    expect(
      channelsFor({ type: "DM_MESSAGE", prefs, timeZone: "Africa/Lagos", now: night }),
    ).toEqual({ inApp: true, push: false, email: false });
    expect(
      channelsFor({ type: "DM_MESSAGE", prefs: defaultPrefs, timeZone: "Africa/Lagos", now: night })
        .push,
    ).toBe(true);
  });
  it("falls back to Lagos for an unknown zone instead of throwing", () => {
    expect(() => inQuietHours(night, "Not/AZone", "22:00", "07:00")).not.toThrow();
  });
});

describe("preferences", () => {
  it("enables email only where a missed message costs something", () => {
    const on = ["CALL_MISSED", "SECURITY_NEW_DEVICE", "ROOM_INVITE", "ROOM_STARTING"];
    for (const t of NOTIFICATION_TYPES) {
      expect(defaultSwitches(t).email).toBe(on.includes(t));
    }
    expect(defaultSwitches("ROOM_ENDED").push).toBe(false);
  });
  it("respects per type switches", () => {
    const prefs = {
      ...defaultPrefs,
      switches: { DM_MESSAGE: { inApp: true, push: false, email: false } },
    };
    expect(channelsFor({ type: "DM_MESSAGE", prefs, timeZone: "UTC", now: new Date() }).push).toBe(
      false,
    );
    expect(channelsFor({ type: "ROOM_INVITE", prefs, timeZone: "UTC", now: new Date() }).push).toBe(
      true,
    );
  });
});

describe("notification links", () => {
  it("always point inside the app", () => {
    for (const t of NOTIFICATION_TYPES) {
      const href = notificationHref(t, { conversationId: "c1", roomSlug: "abc" });
      expect(href.startsWith("/app")).toBe(true);
    }
    expect(notificationHref("DM_MESSAGE", { conversationId: "c1" })).toBe("/app/chats/c1");
    expect(notificationHref("DM_MESSAGE", {})).toBe("/app/chats");
  });
});

describe("receipts", () => {
  const sent = new Date("2026-10-10T10:00:00Z");
  const later = new Date("2026-10-10T10:05:00Z");
  const earlier = new Date("2026-10-10T09:00:00Z");
  it("goes sent, delivered, read", () => {
    const base = { messageCreatedAt: sent, peerSendsReadReceipts: true };
    expect(receiptStatus({ ...base, peerDeliveredAt: null, peerReadAt: null })).toBe("SENT");
    expect(receiptStatus({ ...base, peerDeliveredAt: later, peerReadAt: null })).toBe("DELIVERED");
    expect(receiptStatus({ ...base, peerDeliveredAt: later, peerReadAt: later })).toBe("READ");
    expect(receiptStatus({ ...base, peerDeliveredAt: earlier, peerReadAt: earlier })).toBe("SENT");
  });
  it("hides read when the other person turned read receipts off", () => {
    expect(
      receiptStatus({
        messageCreatedAt: sent,
        peerDeliveredAt: later,
        peerReadAt: later,
        peerSendsReadReceipts: false,
      }),
    ).toBe("DELIVERED");
  });
  it("only moves cursors forward", () => {
    expect(advanceCursor(null, sent)).toEqual(sent);
    expect(advanceCursor(later, sent)).toBeNull();
    expect(advanceCursor(sent, sent)).toBeNull();
    expect(advanceCursor(sent, later)).toEqual(later);
  });
});
