import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NotificationDto, NotificationType } from "../../packages/shared/src";
import { defaultPrefs } from "../../packages/shared/src";
import { FakeStore, sub } from "../helpers/fake-store";
import { arrives, once, sleep, startHarness, type Harness } from "../helpers/realtime";

let h: Harness;

const note = (
  id: string,
  type: NotificationType,
  payload: Record<string, unknown> = {},
): NotificationDto => ({
  id,
  type,
  payload,
  readAt: null,
  createdAt: new Date().toISOString(),
  href: "/app/chats",
});

const dm = (id = "n1") =>
  note(id, "DM_MESSAGE", {
    conversationId: "c1",
    fromName: "Ada",
    preview: "Are you coming tonight?",
    count: 1,
  });

beforeEach(async () => {
  h = await startHarness({ store: new FakeStore().addUser("bayo").addUser("ada") });
});
afterEach(async () => {
  await h.stop();
});

describe("the stale tab scenario", () => {
  it("pushes to every subscription when there is no live socket at all", async () => {
    h.store.addNotification({
      userId: "bayo",
      notification: dm(),
      subscriptions: [sub("phone"), sub("laptop")],
    });
    h.store.addJob("j1", "n1");
    expect(await h.postEvent({ type: "notify", notificationId: "n1" })).toBe(202);
    await sleep(100);
    expect(h.push.sent).toHaveLength(2);
    const { payload } = h.push.sent[0]!;
    expect(payload).toMatchObject({
      type: "DM_MESSAGE",
      title: "Ada",
      body: "Are you coming tonight?",
      tag: "dm:c1",
      url: "/app/chats/c1",
    });
    expect(payload.badge).toBe(1);
  });

  it("delivers a job that came due while the service was asleep, once", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("phone")] });
    h.store.addJob("j1", "n1", new Date(Date.now() - 60 * 60_000));
    expect(await h.rt.scheduler.runOnce()).toBe(1);
    expect(h.push.sent).toHaveLength(1);
    expect(await h.rt.scheduler.runOnce()).toBe(0);
    expect(h.push.sent).toHaveLength(1);
  });

  it("does not deliver twice when a hint and the scheduler race", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("phone")] });
    h.store.addJob("j1", "n1");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await sleep(100);
    await h.rt.scheduler.runOnce();
    expect(h.push.sent).toHaveLength(1);
  });

  it("ignores jobs that are not due yet", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("phone")] });
    h.store.addJob("j1", "n1", new Date(Date.now() + 60_000));
    expect(await h.rt.scheduler.runOnce()).toBe(0);
    expect(h.push.sent).toHaveLength(0);
  });
});

describe("socket versus push", () => {
  it("skips push while a focused tab is open, but still updates the list", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("phone")] });
    h.store.addJob("j1", "n1");
    const bayo = await h.client("bayo");
    bayo.emit("app:focus", { focused: true });
    await sleep(60);
    const seen = once<{ notification: NotificationDto }>(bayo, "notification:new");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    expect((await seen).notification.id).toBe("n1");
    await sleep(80);
    expect(h.push.sent).toHaveLength(0);
  });

  it("pushes when a tab is open but not focused", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("phone")] });
    h.store.addJob("j1", "n1");
    const bayo = await h.client("bayo");
    bayo.emit("app:focus", { focused: false });
    await sleep(60);
    const seen = once(bayo, "notification:new");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await seen;
    await sleep(80);
    expect(h.push.sent).toHaveLength(1);
  });

  it("sends the unread badge with the notification", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), unread: 4, chatsUnread: 2 });
    h.store.addJob("j1", "n1");
    const bayo = await h.client("bayo");
    const badge = once(bayo, "badge:update");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    expect(await badge).toEqual({ notifications: 4, chats: 2 });
  });

  it("never sends to someone else's sockets", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [] });
    h.store.addJob("j1", "n1");
    const ada = await h.client("ada");
    const seen = arrives(ada, "notification:new");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    expect(await seen).toBe(false);
  });
});

describe("preferences", () => {
  it("uses a generic body when previews are off", async () => {
    h.store.addNotification({
      userId: "bayo",
      notification: dm(),
      prefs: { ...defaultPrefs, previews: false },
      subscriptions: [sub("phone")],
    });
    h.store.addJob("j1", "n1");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await sleep(100);
    expect(h.push.sent[0]!.payload.body).toBe("New message");
  });

  it("skips push when that type is switched off", async () => {
    h.store.addNotification({
      userId: "bayo",
      notification: dm(),
      prefs: {
        ...defaultPrefs,
        switches: { DM_MESSAGE: { inApp: true, push: false, email: false } },
      },
      subscriptions: [sub("phone")],
    });
    h.store.addJob("j1", "n1");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await sleep(100);
    expect(h.push.sent).toHaveLength(0);
  });

  it("stays quiet during quiet hours", async () => {
    const all = { ...defaultPrefs, quietStart: "00:00", quietEnd: "23:59" };
    h.store.addNotification({
      userId: "bayo",
      notification: dm(),
      prefs: all,
      subscriptions: [sub("phone")],
    });
    h.store.addJob("j1", "n1");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await sleep(100);
    expect(h.push.sent).toHaveLength(0);
  });
});

describe("subscription lifecycle", () => {
  it("revokes a subscription the push service says is gone (410)", async () => {
    h.push.result = { ok: false, statusCode: 410 };
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("old")] });
    h.store.addJob("j1", "n1");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await sleep(100);
    expect(h.store.pushResults).toEqual([{ subscriptionId: "old", ok: false, revoke: true }]);
  });

  it("keeps a subscription after a one off failure and revokes after repeated ones", async () => {
    h.push.result = { ok: false, statusCode: 500 };
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("flaky")] });
    h.store.addJob("j1", "n1");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await sleep(100);
    expect(h.store.pushResults[0]).toEqual({ subscriptionId: "flaky", ok: false, revoke: false });

    h.store.addNotification({
      userId: "bayo",
      notification: dm("n2"),
      subscriptions: [{ ...sub("flaky"), failureCount: 4 }],
    });
    h.store.addJob("j2", "n2");
    await h.postEvent({ type: "notify", notificationId: "n2" });
    await sleep(100);
    expect(h.store.pushResults[1]).toEqual({ subscriptionId: "flaky", ok: false, revoke: true });
  });

  it("records success", async () => {
    h.store.addNotification({ userId: "bayo", notification: dm(), subscriptions: [sub("ok")] });
    h.store.addJob("j1", "n1");
    await h.postEvent({ type: "notify", notificationId: "n1" });
    await sleep(100);
    expect(h.store.pushResults).toEqual([{ subscriptionId: "ok", ok: true, revoke: false }]);
  });
});

describe("copy for each notification type", () => {
  it("builds a push for friend requests and security notices", async () => {
    h.store.addNotification({
      userId: "bayo",
      notification: note("f1", "FRIEND_REQUEST_RECEIVED", {
        requestId: "r1",
        fromName: "Ada",
        fromUsername: "ada",
      }),
      subscriptions: [sub("phone")],
    });
    h.store.addJob("jf", "f1");
    await h.postEvent({ type: "notify", notificationId: "f1" });
    await sleep(100);
    expect(h.push.sent[0]!.payload).toMatchObject({
      type: "FRIEND_REQUEST",
      tag: "fr:r1",
      url: "/app/friends?tab=requests",
    });

    h.store.addNotification({
      userId: "bayo",
      notification: note("s1", "SECURITY_NEW_DEVICE", {
        sessionId: "sess9",
        device: "Chrome on Windows",
      }),
      subscriptions: [sub("phone")],
    });
    h.store.addJob("js", "s1");
    await h.postEvent({ type: "notify", notificationId: "s1" });
    await sleep(100);
    expect(h.push.sent[1]!.payload).toMatchObject({
      type: "SECURITY_NEW_DEVICE",
      tag: "sec:sess9",
    });
    expect(h.push.sent[1]!.payload.body).toContain("Chrome on Windows");
  });
});
