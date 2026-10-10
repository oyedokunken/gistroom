import { describe, expect, it } from "vitest";
import {
  decidePush,
  parsePush,
  planClick,
  sameOriginPath,
  type PushData,
} from "../../apps/web/sw/logic";

const push = (over: Partial<PushData> = {}): PushData => ({
  type: "DM_MESSAGE",
  title: "Ada",
  body: "Are you coming tonight?",
  url: "/app/chats/c1",
  tag: "dm:c1",
  badge: 2,
  data: {},
  ...over,
});
const looking = [{ visible: true, focused: true }];
const away = [{ visible: false, focused: false }];

describe("parsePush", () => {
  it("falls back to a visible notification for a bad or empty payload", () => {
    for (const raw of [null, "", "not json", "{}", '{"title":5}']) {
      const p = parsePush(raw);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.url.startsWith("/")).toBe(true);
    }
  });
  it("refuses links that leave the app", () => {
    expect(parsePush(JSON.stringify({ url: "https://evil.example" })).url).toBe(
      "/app/notifications",
    );
    expect(parsePush(JSON.stringify({ url: "//evil.example" })).url).toBe("/app/notifications");
    expect(parsePush(JSON.stringify({ url: "/app/chats/1" })).url).toBe("/app/chats/1");
  });
});

describe("decidePush", () => {
  it("skips a message when a window is focused, so the page handles it", () => {
    expect(decidePush(push(), looking)).toEqual({ kind: "SKIP" });
  });
  it("shows a message when no window is focused", () => {
    const plan = decidePush(push(), away);
    expect(plan.kind).toBe("SHOW");
    if (plan.kind === "SHOW") {
      expect(plan.options).toMatchObject({
        tag: "dm:c1",
        requireInteraction: false,
        renotify: true,
      });
      expect(plan.options.data.url).toBe("/app/chats/c1");
    }
  });
  it("shows a message when there is no window at all (the stale tab scenario)", () => {
    expect(decidePush(push(), []).kind).toBe("SHOW");
  });
  it("always rings for a call, even with a focused window, with Answer and Decline", () => {
    const plan = decidePush(
      push({
        type: "CALL_INCOMING",
        title: "Ada is calling",
        body: "Audio call",
        tag: "call:9",
        data: { callId: "9" },
      }),
      looking,
    );
    expect(plan.kind).toBe("SHOW");
    if (plan.kind === "SHOW") {
      expect(plan.options.requireInteraction).toBe(true);
      expect(plan.options.actions?.map((a) => a.action)).toEqual(["answer", "decline"]);
      expect(plan.options.vibrate?.length).toBeGreaterThan(0);
    }
  });
  it("closes the ring and leaves a quiet missed call when the call is cancelled", () => {
    const plan = decidePush(
      push({
        type: "CALL_CANCEL",
        title: "Missed call",
        body: "Missed call from Ada.",
        tag: "call:9",
      }),
      looking,
    );
    expect(plan.kind).toBe("CANCEL_CALL");
    if (plan.kind === "CANCEL_CALL") {
      expect(plan.tag).toBe("call:9");
      expect(plan.missed.options.silent).toBe(true);
      expect(plan.missed.options.tag).toBe("call:9");
      expect(plan.missed.options.data.url).toBe("/app/calls");
    }
  });
});

describe("planClick", () => {
  it("answers a call by opening the call screen", () => {
    expect(planClick("answer", { callId: "9", url: "/app/chats" })).toEqual({
      url: "/app/call/9?answer=1",
      decline: null,
    });
    expect(planClick("", { callId: "9" })).toEqual({ url: "/app/call/9?answer=1", decline: null });
  });
  it("declines without opening anything", () => {
    expect(planClick("decline", { callId: "9", url: "/app/chats" })).toEqual({
      url: "/app/chats",
      decline: { callId: "9" },
    });
  });
  it("opens the notification link for everything else and never an outside one", () => {
    expect(planClick("", { url: "/app/friends?tab=requests" }).url).toBe(
      "/app/friends?tab=requests",
    );
    expect(planClick("", { url: "https://evil.example" }).url).toBe("/app/chats");
  });
});

describe("sameOriginPath", () => {
  it("keeps same site paths and drops others", () => {
    expect(sameOriginPath("/app/chats?x=1", "https://gistroom.ng")).toBe("/app/chats?x=1");
    expect(sameOriginPath("https://gistroom.ng/app/rooms", "https://gistroom.ng")).toBe(
      "/app/rooms",
    );
    expect(sameOriginPath("https://evil.example/app", "https://gistroom.ng")).toBeNull();
  });
});

import { isIos, urlBase64ToUint8Array } from "../../apps/web/src/lib/push-client";

describe("push client helpers", () => {
  it("decodes a base64url VAPID key to bytes", () => {
    const bytes = urlBase64ToUint8Array("AQID_w");
    expect([...bytes]).toEqual([1, 2, 3, 255]);
  });
  it("spots iPhone and iPad", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });
});
