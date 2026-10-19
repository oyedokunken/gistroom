import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_POLICY, type PushPayload } from "@gistroom/shared";

// The push provider is replaced, so nothing here leaves the machine.
const provider = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));
vi.mock("web-push", () => ({ default: provider }));

import { createWebPushSender, topicFor } from "../../apps/realtime/src/push";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const target = { endpoint: "https://push.example/abc", p256dh: "p256dh-key", auth: "auth-key" };
const vapid = { publicKey: "public", privateKey: "private", subject: "mailto:owner@example.com" };

function payload(over: Partial<PushPayload> = {}): PushPayload {
  return {
    type: "DM_MESSAGE",
    title: "Ada",
    body: "New message",
    url: "/app/chats/c1",
    tag: "dm:c1",
    badge: 1,
    data: {},
    ...over,
  };
}

beforeEach(() => {
  provider.setVapidDetails.mockReset();
  provider.sendNotification.mockReset();
  log.warn.mockReset();
});

describe("topic header", () => {
  it("is at most 32 URL safe characters, however long the tag is", () => {
    const long = topicFor(`call:${"x".repeat(500)}`);
    expect(long).toHaveLength(32);
    expect(long).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is stable for one tag and different for another", () => {
    expect(topicFor("dm:c1")).toBe(topicFor("dm:c1"));
    expect(topicFor("dm:c1")).not.toBe(topicFor("dm:c2"));
  });
});

describe("web push sender", () => {
  it("reports disabled, and never calls the provider, when the keys are missing", async () => {
    const sender = createWebPushSender({ subject: vapid.subject }, log);
    expect(await sender.send(target, payload())).toEqual({
      ok: false,
      statusCode: null,
      disabled: true,
    });
    expect(provider.sendNotification).not.toHaveBeenCalled();
    expect(provider.setVapidDetails).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it("is also disabled with only one of the two keys", async () => {
    const sender = createWebPushSender({ publicKey: "public", subject: vapid.subject }, log);
    expect((await sender.send(target, payload())).disabled).toBe(true);
  });

  it("signs with the VAPID details once and sends the payload as JSON with the policy for its type", async () => {
    provider.sendNotification.mockResolvedValue({ statusCode: 201 });
    const sender = createWebPushSender(vapid, log);
    expect(provider.setVapidDetails).toHaveBeenCalledWith(vapid.subject, "public", "private");

    const call = payload({ type: "CALL_INCOMING", tag: "call:abc", title: "Ada is calling" });
    expect(await sender.send(target, call)).toEqual({ ok: true, statusCode: 201 });

    expect(provider.sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, body, options] = provider.sendNotification.mock.calls[0] ?? [];
    expect(subscription).toEqual({
      endpoint: target.endpoint,
      keys: { p256dh: target.p256dh, auth: target.auth },
    });
    expect(JSON.parse(body as string)).toEqual(call);
    expect(options).toEqual({
      TTL: PUSH_POLICY.CALL_INCOMING.ttlSec,
      urgency: "high",
      topic: topicFor("call:abc"),
    });
    expect(provider.setVapidDetails).toHaveBeenCalledTimes(1);
  });

  it("uses the longer life and normal urgency for a message", async () => {
    provider.sendNotification.mockResolvedValue({});
    const sender = createWebPushSender(vapid, log);
    await sender.send(target, payload());
    const options = provider.sendNotification.mock.calls[0]?.[2] as {
      TTL: number;
      urgency: string;
    };
    expect(options.TTL).toBe(86_400);
    expect(options.urgency).toBe("normal");
  });

  it("passes on the status the push service gave, so a dead endpoint can be removed", async () => {
    const sender = createWebPushSender(vapid, log);
    for (const statusCode of [404, 410, 413, 429, 500]) {
      provider.sendNotification.mockRejectedValueOnce(
        Object.assign(new Error("push"), { statusCode }),
      );
      expect(await sender.send(target, payload())).toEqual({ ok: false, statusCode });
    }
  });

  it("reports a failure with no status, such as a network error, as null", async () => {
    provider.sendNotification.mockRejectedValueOnce(new Error("socket hang up"));
    const sender = createWebPushSender(vapid, log);
    expect(await sender.send(target, payload())).toEqual({ ok: false, statusCode: null });
  });
});
