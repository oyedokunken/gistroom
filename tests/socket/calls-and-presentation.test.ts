import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CallDto } from "../../packages/shared/src";
import type { CallDelivery } from "../../apps/realtime/src/store";
import { FakeStore, person, sub } from "../helpers/fake-store";
import {
  arrives,
  buffered,
  INTERNAL,
  once,
  sleep,
  startHarness,
  type Harness,
} from "../helpers/realtime";

let h: Harness;

const callDto = (direction: "INCOMING" | "OUTGOING", status: CallDto["status"]): CallDto => ({
  id: "call1",
  status,
  media: "VIDEO",
  direction,
  peer: person(direction === "INCOMING" ? "ada" : "bayo"),
  conversationId: null,
  ringExpiresAt: "2026-11-09T12:00:45.000Z",
  answeredAt: null,
  endedAt: null,
  endReason: null,
  endedBy: null,
  peerReachable: null,
});

const delivery = (status: CallDelivery["status"]): CallDelivery => ({
  callId: "call1",
  callerId: "ada",
  calleeId: "bayo",
  status,
  media: "VIDEO",
  callerName: "Ada",
  dtoFor: new Map([
    ["ada", callDto("OUTGOING", status)],
    ["bayo", callDto("INCOMING", status)],
  ]),
  calleePush: { subscriptions: [sub("phone")], previews: true, unread: 3 },
});

beforeEach(async () => {
  h = await startHarness({ store: new FakeStore().addUser("ada").addUser("bayo") });
});
afterEach(async () => {
  await h.stop();
});

describe("1:1 call delivery", () => {
  it("rings only the callee, in the tab and by push that asks to be answered", async () => {
    h.store.addCall(delivery("RINGING"));
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const ring = once<{ call: CallDto }>(bayo, "call:incoming");
    const adaHeard = arrives(ada, "call:incoming");
    expect(await h.postEvent({ type: "call", callId: "call1", change: "ringing" })).toBe(202);
    expect((await ring).call.direction).toBe("INCOMING");
    expect(await adaHeard).toBe(false);
    await sleep(100);
    // A tab is open and focus does not matter: calls always push (Section 10.1).
    expect(h.push.sent).toHaveLength(1);
    expect(h.push.sent[0]!.payload).toMatchObject({
      type: "CALL_INCOMING",
      title: "Ada is calling",
      url: "/app/call/call1?answer=1",
      badge: 3,
      data: { callId: "call1" },
    });
  });

  it("tells both people when the call is answered and quietly dismisses the ring elsewhere", async () => {
    h.store.addCall(delivery("ACTIVE"));
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const forAda = once<{ call: CallDto }>(ada, "call:accepted");
    const forBayo = once<{ call: CallDto }>(bayo, "call:accepted");
    await h.postEvent({ type: "call", callId: "call1", change: "accepted" });
    expect((await forAda).call.direction).toBe("OUTGOING");
    expect((await forBayo).call.direction).toBe("INCOMING");
    await sleep(100);
    expect(h.push.sent[0]!.payload).toMatchObject({
      type: "CALL_CANCEL",
      data: { callId: "call1", reason: "dismiss" },
    });
  });

  it("leaves a missed call note when the caller cancels or the ring runs out", async () => {
    h.store.addCall(delivery("MISSED"));
    await h.postEvent({ type: "call", callId: "call1", change: "cancelled" });
    await sleep(100);
    const payload = h.push.sent[0]!.payload;
    expect(payload).toMatchObject({ type: "CALL_CANCEL", url: "/app/calls" });
    expect(payload.data).toEqual({ callId: "call1" });
  });

  it("sends no push when a call ends, and ignores a call that is gone", async () => {
    h.store.addCall(delivery("ENDED"));
    const bayo = await h.client("bayo");
    const ended = once(bayo, "call:ended");
    await h.postEvent({ type: "call", callId: "call1", change: "ended" });
    await ended;
    await h.postEvent({ type: "call", callId: "missing", change: "ringing" });
    await sleep(100);
    expect(h.push.sent).toHaveLength(0);
  });
});

describe("presentation hints", () => {
  it("reach both people in a call with the call id and no source name", async () => {
    h.store.addCall(delivery("ACTIVE"));
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const heard = once(bayo, "presentation:changed");
    await h.postEvent({ type: "presentation", scope: "call", refId: "call1", change: "started" });
    expect(await heard).toEqual({ scope: "call", ref: "call1", change: "started" });
    expect(await buffered(ada, "presentation:changed")).toEqual({
      scope: "call",
      ref: "call1",
      change: "started",
    });
  });

  it("reach only the people inside a room, by room slug", async () => {
    h.store.addUser("cleo").addRoom({ id: "r1", joinedIds: ["ada"], slug: "match-day" });
    const ada = await h.client("ada");
    const cleo = await h.client("cleo");
    const heard = once(ada, "presentation:changed");
    const outsider = arrives(cleo, "presentation:changed");
    await h.postEvent({ type: "presentation", scope: "room", refId: "r1", change: "stopped" });
    expect(await heard).toEqual({ scope: "room", ref: "match-day", change: "stopped" });
    expect(await outsider).toBe(false);
  });
});

describe("the Settings test push", () => {
  const post = (body: unknown, token: string | null = INTERNAL) =>
    fetch(`${h.url}/internal/push-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it("refuses a missing or wrong service token", async () => {
    expect((await post({ subscriptionId: "phone" }, null)).status).toBe(401);
    expect((await post({ subscriptionId: "phone" }, "x".repeat(40))).status).toBe(401);
    expect(h.push.sent).toHaveLength(0);
  });

  it("rejects a body without a subscription id and answers 404 for an unknown device", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ subscriptionId: 7 })).status).toBe(400);
    expect((await post({ subscriptionId: "nope" })).status).toBe(404);
  });

  it("pushes once to that device and records a success", async () => {
    h.store.addCall(delivery("RINGING"));
    const res = await post({ subscriptionId: "phone" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, statusCode: 201, gone: false });
    expect(h.push.sent).toHaveLength(1);
    expect(h.push.sent[0]!.payload).toMatchObject({
      tag: "test",
      url: "/app/settings/notifications",
    });
    expect(h.store.pushResults).toEqual([{ subscriptionId: "phone", ok: true, revoke: false }]);
  });

  it("reports a device the push service no longer knows and revokes it", async () => {
    h.store.addCall(delivery("RINGING"));
    h.push.result = { ok: false, statusCode: 410 };
    const res = await post({ subscriptionId: "phone" });
    expect(await res.json()).toEqual({ ok: false, statusCode: 410, gone: true });
    expect(h.store.pushResults).toEqual([{ subscriptionId: "phone", ok: false, revoke: true }]);
  });
});
