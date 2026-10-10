import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signRealtimePass } from "../../packages/shared/src/pass";
import { FakeStore } from "../helpers/fake-store";
import {
  arrives,
  buffered,
  once,
  sleep,
  SECRET,
  startHarness,
  type Harness,
} from "../helpers/realtime";

let h: Harness;

function world(): FakeStore {
  return new FakeStore()
    .addUser("ada")
    .addUser("bayo")
    .addUser("chidi")
    .befriend("ada", "bayo")
    .addConversation("c1", "ada", "bayo")
    .addConversation("c2", "bayo", "chidi")
    .addMessage("m1", "c1", 1)
    .addMessage("m2", "c1", 2);
}

beforeEach(async () => {
  h = await startHarness({ store: world() });
});
afterEach(async () => {
  await h.stop();
});

describe("connection auth", () => {
  it("rejects a missing, malformed or wrongly signed pass", async () => {
    expect(await h.tryConnect(undefined)).toEqual({ ok: false, code: "unauthorized" });
    expect(await h.tryConnect("nonsense")).toEqual({ ok: false, code: "unauthorized" });
    const forged = signRealtimePass({ userId: "ada", sessionId: "s" }, "x".repeat(40));
    expect(await h.tryConnect(forged)).toEqual({ ok: false, code: "unauthorized" });
  });

  it("rejects an expired pass with auth_expired so the client can fetch a new one", async () => {
    const old = signRealtimePass(
      { userId: "ada", sessionId: "s-ada" },
      SECRET,
      new Date(Date.now() - 20 * 60_000),
    );
    h.store.addSession("ada", "s-ada");
    expect(await h.tryConnect(old)).toEqual({ ok: false, code: "auth_expired" });
  });

  it("rejects a pass whose session was revoked", async () => {
    const token = signRealtimePass({ userId: "ada", sessionId: "gone" }, SECRET);
    expect(await h.tryConnect(token)).toEqual({ ok: false, code: "session_revoked" });
  });

  it("accepts a valid pass", async () => {
    const ada = await h.client("ada");
    expect(ada.connected).toBe(true);
  });

  it("kicks a socket when its session is revoked while connected", async () => {
    const ada = await h.client("ada", "s-ada");
    const revoked = once(ada, "session:revoked");
    const closed = once(ada, "disconnect");
    expect(await h.postEvent({ type: "session:revoked", userId: "ada", sessionId: "s-ada" })).toBe(
      202,
    );
    await revoked;
    await closed;
  });

  it("re-checks the session on a timer and disconnects a revoked one", async () => {
    await h.stop();
    h = await startHarness({ store: world(), recheckMs: 40 });
    const ada = await h.client("ada", "s-ada");
    const closed = once(ada, "disconnect");
    h.store.validSessions.delete("ada:s-ada");
    await closed;
  });
});

describe("presence and privacy", () => {
  it("tells friends when someone comes online and goes offline", async () => {
    const bayo = await h.client("bayo");
    const online = once<{ userId: string; online: boolean }>(bayo, "presence:update");
    const ada = await h.client("ada");
    expect(await online).toMatchObject({ userId: "ada", online: true });
    const offline = once<{ userId: string; online: boolean; lastSeenAt: string | null }>(
      bayo,
      "presence:update",
    );
    ada.disconnect();
    const update = await offline;
    expect(update).toMatchObject({ userId: "ada", online: false });
    expect(update.lastSeenAt).not.toBeNull();
    await sleep(50);
    expect(h.store.lastSeen.has("ada")).toBe(true);
  });

  it("sends a snapshot of friends already online", async () => {
    await h.client("ada");
    const bayo = await h.client("bayo");
    const snap = await buffered<{ userId: string; online: boolean }>(bayo, "presence:update");
    expect(snap).toMatchObject({ userId: "ada", online: true });
  });

  it("stays hidden when the person turned presence off", async () => {
    h.store.addUser("ada", { showPresence: false });
    const bayo = await h.client("bayo");
    const seen = arrives(bayo, "presence:update");
    await h.client("ada");
    expect(await seen).toBe(false);
  });

  it("shows nothing to someone who has presence off themselves", async () => {
    h.store.addUser("bayo", { showPresence: false });
    const bayo = await h.client("bayo");
    const seen = arrives(bayo, "presence:update");
    await h.client("ada");
    expect(await seen).toBe(false);
  });

  it("never tells strangers", async () => {
    const chidi = await h.client("chidi");
    const seen = arrives(chidi, "presence:update");
    await h.client("ada");
    expect(await seen).toBe(false);
  });
});

describe("typing", () => {
  it("is relayed to the other person in the conversation", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const typing = once<{ conversationId: string; userId: string }>(bayo, "typing:start");
    ada.emit("typing:start", { conversationId: "c1" });
    expect(await typing).toEqual({ conversationId: "c1", userId: "ada" });
    const stop = once(bayo, "typing:stop");
    ada.emit("typing:stop", { conversationId: "c1" });
    await stop;
  });

  it("is dropped for a conversation the person is not in (R16)", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const chidi = await h.client("chidi");
    const bayoSees = arrives(bayo, "typing:start");
    const chidiSees = arrives(chidi, "typing:start");
    ada.emit("typing:start", { conversationId: "c2" });
    expect(await bayoSees).toBe(false);
    expect(await chidiSees).toBe(false);
  });

  it("is dropped after a block", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    h.store.blocked.add("bayo>ada");
    const seen = arrives(bayo, "typing:start");
    ada.emit("typing:start", { conversationId: "c1" });
    expect(await seen).toBe(false);
  });

  it("ignores malformed payloads", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const seen = arrives(bayo, "typing:start");
    ada.emit("typing:start", { conversationId: 42 });
    ada.emit("typing:start", "nope");
    expect(await seen).toBe(false);
  });
});

describe("receipts", () => {
  it("tells the sender when a message is delivered and read", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const delivered = once(ada, "message:delivered");
    bayo.emit("message:ack", { conversationId: "c1", messageId: "m1", kind: "delivered" });
    expect(await delivered).toEqual({ conversationId: "c1", userId: "bayo", messageId: "m1" });
    const read = once(ada, "message:read");
    bayo.emit("message:ack", { conversationId: "c1", messageId: "m1", kind: "read" });
    expect(await read).toMatchObject({ messageId: "m1", userId: "bayo" });
  });

  it("does not repeat an ack that did not move the cursor", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    bayo.emit("message:ack", { conversationId: "c1", messageId: "m2", kind: "read" });
    await once(ada, "message:read");
    const again = arrives(ada, "message:read");
    bayo.emit("message:ack", { conversationId: "c1", messageId: "m1", kind: "read" });
    expect(await again).toBe(false);
  });

  it("keeps reads private when read receipts are off", async () => {
    h.store.addUser("bayo", { sendReadReceipts: false });
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const seen = arrives(ada, "message:read");
    bayo.emit("message:ack", { conversationId: "c1", messageId: "m1", kind: "read" });
    expect(await seen).toBe(false);
  });

  it("refuses acks for a conversation the person is not in", async () => {
    const ada = await h.client("ada");
    await h.client("chidi");
    const chidi = h.clients[h.clients.length - 1]!;
    const seen = arrives(ada, "message:read");
    chidi.emit("message:ack", { conversationId: "c1", messageId: "m1", kind: "read" });
    expect(await seen).toBe(false);
    expect(h.store.acks.some((a) => a.userId === "chidi")).toBe(false);
  });
});

describe("rate limits", () => {
  it("drops typing beyond 5 per second", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    let received = 0;
    bayo.on("typing:start", () => (received += 1));
    for (let i = 0; i < 40; i += 1) ada.emit("typing:start", { conversationId: "c1" });
    await sleep(500);
    expect(received).toBeGreaterThan(0);
    expect(received).toBeLessThanOrEqual(8);
  });

  it("disconnects a socket that keeps flooding", async () => {
    const ada = await h.client("ada");
    const closed = once(ada, "disconnect", 3000);
    for (let i = 0; i < 400; i += 1) ada.emit("typing:start", { conversationId: "c1" });
    await closed;
  });

  it("disconnects a socket that sends unknown events", async () => {
    const ada = await h.client("ada");
    const closed = once(ada, "disconnect", 3000);
    for (let i = 0; i < 40; i += 1) ada.emit("admin:do_thing", { x: i });
    await closed;
  });
});

describe("internal events", () => {
  it("require the bearer token", async () => {
    expect(await h.postEvent({ type: "badge", userId: "ada" }, "")).toBe(401);
    expect(await h.postEvent({ type: "badge", userId: "ada" }, "w".repeat(40))).toBe(401);
  });

  it("reject payloads that do not match the shared schema", async () => {
    expect(await h.postEvent({ type: "nope" })).toBe(400);
    expect(await h.postEvent({ type: "badge" })).toBe(400);
  });

  it("fan a new message out to both people with their own view", async () => {
    const ada = await h.client("ada");
    const bayo = await h.client("bayo");
    const a = once<{ message: { body: string } }>(ada, "message:new");
    const b = once<{ message: { body: string } }>(bayo, "message:new");
    expect(await h.postEvent({ type: "message:new", messageId: "m1" })).toBe(202);
    expect((await a).message.body).toBe("hello ada");
    expect((await b).message.body).toBe("hello bayo");
  });

  it("does not reach a stranger", async () => {
    await h.client("ada");
    const chidi = await h.client("chidi");
    const seen = arrives(chidi, "message:new");
    await h.postEvent({ type: "message:new", messageId: "m1" });
    expect(await seen).toBe(false);
  });

  it("sends updated badge counts", async () => {
    const ada = await h.client("ada");
    h.store.counts_ = { notifications: 3, chats: 2 };
    const badge = once(ada, "badge:update");
    await h.postEvent({ type: "badge", userId: "ada" });
    expect(await badge).toEqual({ notifications: 3, chats: 2 });
  });
});
