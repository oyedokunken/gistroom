import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIMITS,
  PUSH_POLICY,
  joinVerdict,
  notificationCopy,
  plainPushPayload,
  type CallDto,
  type JoinInput,
} from "@gistroom/shared";
import { showCallOutcome } from "../../apps/web/src/lib/live/call-outcomes";
import { useSessionModals } from "../../apps/web/src/lib/session/modals";
import {
  browserFamily,
  isInAppBrowser,
  permissionSteps,
  unsupportedReason,
} from "../../apps/web/src/lib/session/browser";
import {
  PresenceAnnouncer,
  RECONNECT_WINDOW_MS,
  type Announcement,
} from "../../apps/web/src/lib/session/presence-announcer";
import { verifyWebhook } from "../../apps/web/src/server/livekit-webhook";
import { formatDuration } from "../../apps/web/src/lib/chat/voice";

describe("presence announcements", () => {
  let out: Announcement[];
  let timers: Map<number, () => void>;
  let announcer: PresenceAnnouncer;
  beforeEach(() => {
    out = [];
    timers = new Map();
    let n = 1;
    announcer = new PresenceAnnouncer(
      {
        setTimeout: (fn) => {
          timers.set(n, fn);
          return n++;
        },
        clearTimeout: (h) => void timers.delete(h as number),
        announce: (a) => out.push(a),
      },
      () => "me",
    );
  });
  const flush = () => {
    const all = [...timers.values()];
    timers.clear();
    all.forEach((fn) => fn());
  };

  it("never announces you to yourself", () => {
    announcer.joined("me", "Me");
    announcer.left("me", "Me");
    flush();
    expect(out).toEqual([]);
  });

  it("announces a join, and a leave only after the reconnect window", () => {
    announcer.joined("a", "Ada");
    announcer.left("a", "Ada");
    expect(out).toEqual([{ kind: "joined", name: "Ada" }]);
    flush();
    expect(out).toEqual([
      { kind: "joined", name: "Ada" },
      { kind: "left", name: "Ada" },
    ]);
    expect(RECONNECT_WINDOW_MS).toBe(10_000);
  });

  it("says reconnected, not left then joined, when someone drops and returns", () => {
    announcer.joined("a", "Ada");
    announcer.left("a", "Ada");
    announcer.joined("a", "Ada");
    flush();
    expect(out).toEqual([
      { kind: "joined", name: "Ada" },
      { kind: "reconnected", name: "Ada" },
    ]);
  });

  it("does not announce the people who were already there", () => {
    announcer.seed(["a", "b"]);
    announcer.joined("a", "Ada");
    expect(out).toEqual([]);
  });

  it("does not repeat a leave for the same person while waiting", () => {
    announcer.joined("a", "Ada");
    announcer.left("a", "Ada");
    announcer.left("a", "Ada");
    flush();
    expect(out.filter((a) => a.kind === "left")).toHaveLength(1);
  });

  it("clears pending leaves on dispose", () => {
    announcer.joined("a", "Ada");
    announcer.left("a", "Ada");
    announcer.dispose();
    flush();
    expect(out.filter((a) => a.kind === "left")).toHaveLength(0);
  });
});

describe("browser support", () => {
  const chrome =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";
  const facebook = "Mozilla/5.0 (iPhone) AppleWebKit/605.1 Mobile [FBAN/FBIOS;FBAV/450.0]";
  const instagram = "Mozilla/5.0 (iPhone) AppleWebKit/605.1 Instagram 300.0";

  it("spots the browsers built into other apps", () => {
    expect(isInAppBrowser(facebook)).toBe(true);
    expect(isInAppBrowser(instagram)).toBe(true);
    expect(isInAppBrowser(chrome)).toBe(false);
  });

  it("explains why a browser cannot join", () => {
    expect(unsupportedReason(facebook, true, true)).toBe("in-app");
    expect(unsupportedReason(chrome, false, true)).toBe("no-media");
    expect(unsupportedReason(chrome, true, false)).toBe("no-media");
    expect(unsupportedReason(chrome, true, true)).toBeNull();
  });

  it("gives the steps for the browser in use", () => {
    expect(browserFamily(chrome)).toBe("chrome");
    expect(browserFamily("Mozilla/5.0 Firefox/120.0")).toBe("firefox");
    expect(browserFamily("Mozilla/5.0 (iPhone) Version/17 Safari/605.1")).toBe("safari");
    expect(permissionSteps(chrome).length).toBeGreaterThan(1);
    expect(permissionSteps("Mozilla/5.0 Firefox/120.0")).not.toEqual(permissionSteps(chrome));
  });
});

describe("how a call is told as over", () => {
  const call = (over: Partial<CallDto>): CallDto => ({
    id: `c-${Math.random()}`,
    status: "ENDED",
    media: "AUDIO",
    direction: "OUTGOING",
    peer: { id: "p", name: "Ada", username: "ada", avatarUrl: null, bio: null } as CallDto["peer"],
    conversationId: "conv",
    ringExpiresAt: new Date().toISOString(),
    answeredAt: new Date(Date.now() - 125_000).toISOString(),
    endedAt: new Date().toISOString(),
    endReason: "end",
    endedBy: "ME",
    peerReachable: null,
    ...over,
  });
  const nav = { push: vi.fn() };
  beforeEach(() => useSessionModals.setState({ list: [], counter: 0 }));
  const shown = () => useSessionModals.getState().list[0];

  it("says who left, with how long it lasted", () => {
    showCallOutcome(call({ endedBy: "PEER" }), nav);
    expect(shown()?.title).toBe("Ada left the call");
    expect(shown()?.body).toContain("2:05");
    expect(shown()?.actions.map((a) => a.label)).toEqual(["Call again", "Message", "Close"]);
  });

  it("gives you a summary when you hang up yourself", () => {
    showCallOutcome(call({ endedBy: "ME" }), nav);
    expect(shown()?.title).toBe("Call ended");
    expect(shown()?.actions.map((a) => a.label)).toContain("Call back");
  });

  it("tells the caller why nobody answered", () => {
    showCallOutcome(call({ status: "DECLINED", answeredAt: null, endedBy: "PEER" }), nav);
    expect(shown()?.title).toBe("Ada declined");
    useSessionModals.setState({ list: [], counter: 0 });
    showCallOutcome(call({ status: "BUSY", answeredAt: null }), nav);
    expect(shown()?.title).toBe("Ada is busy");
    useSessionModals.setState({ list: [], counter: 0 });
    showCallOutcome(call({ status: "MISSED", answeredAt: null }), nav);
    expect(shown()?.title).toBe("Ada didn't pick up");
  });

  it("shows a missed call to the person who was called", () => {
    showCallOutcome(call({ status: "CANCELLED", direction: "INCOMING", answeredAt: null }), nav);
    expect(shown()?.title).toBe("Missed call from Ada");
  });

  it("says nothing when you cancel or decline yourself", () => {
    showCallOutcome(call({ status: "CANCELLED", answeredAt: null }), nav);
    showCallOutcome(call({ status: "DECLINED", direction: "INCOMING", answeredAt: null }), nav);
    expect(useSessionModals.getState().list).toHaveLength(0);
  });

  it("never says why when a block ended the call", () => {
    showCallOutcome(call({ endReason: "blocked", endedBy: "SYSTEM" }), nav);
    expect(shown()?.title).toBe("This call has ended");
    expect(shown()?.body).toBe("");
  });

  it("tells a dropped call as unreachable", () => {
    showCallOutcome(call({ endReason: "peer-gone", endedBy: "SYSTEM" }), nav);
    expect(shown()?.title).toBe("Ada couldn't be reached");
  });

  it("tells the same ending only once", () => {
    const c = call({ endedBy: "PEER" });
    showCallOutcome(c, nav);
    useSessionModals.setState({ list: [], counter: 0 });
    showCallOutcome(c, nav);
    expect(useSessionModals.getState().list).toHaveLength(0);
  });
});

describe("removed people wait before coming back", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const base: JoinInput = {
    status: "LIVE",
    visibility: "PUBLIC",
    locked: false,
    isHost: false,
    member: null,
    linkValid: false,
    joinedCount: 3,
    max: 32,
    now,
  };
  const removed = (minutesAgo: number): JoinInput => ({
    ...base,
    member: {
      state: "REMOVED",
      role: "MEMBER",
      graceUntil: null,
      leftAt: new Date(now.getTime() - minutesAgo * 60_000),
    },
  });

  it("refuses a person removed a moment ago, even with a link", () => {
    expect(joinVerdict(removed(2))).toEqual({ ok: false, reason: "REMOVED" });
    expect(joinVerdict({ ...removed(2), linkValid: true })).toEqual({
      ok: false,
      reason: "REMOVED",
    });
  });

  it("lets them back into a public room after ten minutes", () => {
    expect(LIMITS.ROOM_REMOVE_COOLDOWN_MIN).toBe(10);
    expect(joinVerdict(removed(11)).ok).toBe(true);
  });

  it("needs a new invite for a private room", () => {
    expect(joinVerdict({ ...removed(11), visibility: "PRIVATE" })).toEqual({
      ok: false,
      reason: "NOT_INVITED",
    });
    expect(joinVerdict({ ...removed(11), visibility: "PRIVATE", linkValid: true }).ok).toBe(true);
  });

  it("never lets a banned person back", () => {
    const banned: JoinInput = {
      ...base,
      member: { state: "BANNED", role: "MEMBER", graceUntil: null, leftAt: new Date(0) },
    };
    expect(joinVerdict(banned)).toEqual({ ok: false, reason: "BANNED" });
  });
});

describe("room ring alerts", () => {
  it("rings like a call: short life, high urgency, needs a tap", () => {
    expect(PUSH_POLICY.ROOM_RING).toEqual({
      ttlSec: 45,
      urgency: "high",
      requireInteraction: true,
    });
  });

  it("turns an invite with ring on into a ring alert", () => {
    const ring = notificationCopy(
      "ROOM_INVITE",
      { ring: true, roomId: "r", roomSlug: "slug", roomTitle: "Match talk", fromName: "Ada" },
      "n1",
    );
    expect(ring.kind).toBe("ROOM_RING");
    expect(ring.title).toBe("Ada is ringing you");
    const plain = plainPushPayload({
      type: "ROOM_RING",
      title: ring.title,
      body: ring.body,
      url: ring.url,
      tag: "roomring:r",
      badge: 0,
      data: {},
    });
    expect(plain.body).not.toContain("Ada");
  });

  it("keeps an ordinary invite an invite", () => {
    expect(notificationCopy("ROOM_INVITE", { roomTitle: "x", fromName: "Ada" }, "n").kind).toBe(
      "ROOM_INVITE",
    );
  });
});

describe("live room webhook signature", () => {
  const secret = "s".repeat(40);
  const key = "apikey";
  const body = JSON.stringify({ event: "participant_left", id: "e1", room: { name: "room_x" } });
  const header = (over: { iss?: string; sha?: string; secret?: string } = {}) => {
    const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const p = Buffer.from(
      JSON.stringify({
        iss: over.iss ?? key,
        exp: Math.floor(Date.now() / 1000) + 60,
        sha256: over.sha ?? createHash("sha256").update(body).digest("base64"),
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", over.secret ?? secret)
      .update(`${h}.${p}`)
      .digest("base64url");
    return `${h}.${p}.${sig}`;
  };

  it("accepts a properly signed delivery", () => {
    expect(verifyWebhook(header(), body, secret, key)).toBe(true);
  });

  it("refuses a wrong secret, a wrong key, a changed body and a missing header", () => {
    expect(verifyWebhook(header({ secret: "x".repeat(40) }), body, secret, key)).toBe(false);
    expect(verifyWebhook(header({ iss: "other" }), body, secret, key)).toBe(false);
    expect(verifyWebhook(header(), body + " ", secret, key)).toBe(false);
    expect(verifyWebhook(null, body, secret, key)).toBe(false);
    expect(verifyWebhook("garbage", body, secret, key)).toBe(false);
  });
});

describe("durations", () => {
  afterEach(() => vi.useRealTimers());
  it("uses m:ss under an hour and h:mm:ss from an hour on", () => {
    expect(formatDuration(5_000)).toBe("0:05");
    expect(formatDuration(125_000)).toBe("2:05");
    expect(formatDuration(3_600_000)).toBe("1:00:00");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });
});
