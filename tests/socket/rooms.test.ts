import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeStore } from "../helpers/fake-store";
import { arrives, once, startHarness, type Harness } from "../helpers/realtime";

let h: Harness;

beforeEach(async () => {
  h = await startHarness({
    store: new FakeStore()
      .addUser("bayo")
      .addUser("ada")
      .addUser("chidi")
      .addRoom({ id: "r1", joinedIds: ["bayo", "ada"], allIds: ["bayo", "ada", "chidi"] }),
  });
});
afterEach(async () => {
  await h.stop();
});

const room = (change: string, extra: Record<string, unknown> = {}) => ({
  type: "room",
  roomId: "r1",
  change,
  ...extra,
});

describe("room events reach the people inside and nobody else", () => {
  it("tells everyone inside when a setting changes, and not people outside", async () => {
    const bayo = await h.client("bayo");
    const ada = await h.client("ada");
    const chidi = await h.client("chidi");
    const gotB = once(bayo, "room:settings");
    const gotA = once(ada, "room:settings");
    expect(await h.postEvent(room("settings"))).toBe(202);
    expect(await gotB).toEqual({ roomSlug: "slug-r1" });
    expect(await gotA).toEqual({ roomSlug: "slug-r1" });
    expect(await arrives(chidi, "room:settings")).toBe(false);
  });

  it("floats a reaction for everyone inside, with who sent it", async () => {
    const bayo = await h.client("bayo");
    const ada = await h.client("ada");
    const got = once(ada, "room:reaction");
    const mine = once(bayo, "room:reaction");
    await h.postEvent(room("reaction", { userId: "bayo", emoji: "\u{1F44F}" }));
    expect(await got).toEqual({ roomSlug: "slug-r1", userId: "bayo", emoji: "\u{1F44F}" });
    expect(await mine).toMatchObject({ userId: "bayo" });
  });

  it("drops a reaction event that has no emoji", async () => {
    const ada = await h.client("ada");
    await h.postEvent(room("reaction", { userId: "bayo" }));
    expect(await arrives(ada, "room:reaction")).toBe(false);
  });

  it("tells the room when a moderator mutes one person or everyone", async () => {
    const ada = await h.client("ada");
    const one = once(ada, "room:muted");
    await h.postEvent(room("muted", { userId: "ada", kind: "audio" }));
    expect(await one).toEqual({ roomSlug: "slug-r1", userId: "ada", kind: "audio" });

    const all = once(ada, "room:muted");
    await h.postEvent(room("muted", { userId: "bayo", kind: "all" }));
    expect(await all).toMatchObject({ kind: "all" });

    await h.postEvent(room("muted", { userId: "ada", kind: "video" }));
    expect(await once(ada, "room:muted")).toMatchObject({ kind: "video" });
  });

  it("removes a deleted chat message live and refreshes after a reaction on one", async () => {
    const bayo = await h.client("bayo");
    const gone = once(bayo, "room:chat:deleted");
    await h.postEvent(room("chat-deleted", { messageId: "m1" }));
    expect(await gone).toEqual({ roomSlug: "slug-r1", messageId: "m1" });

    const updated = once(bayo, "room:chat:deleted");
    await h.postEvent(room("chat-updated", { messageId: "m1" }));
    expect(await updated).toMatchObject({ roomSlug: "slug-r1" });
  });

  it("announces lock, end and a person's change to the right audiences", async () => {
    const bayo = await h.client("bayo");
    const chidi = await h.client("chidi");
    const locked = once(bayo, "room:locked");
    await h.postEvent(room("locked"));
    expect(await locked).toEqual({ roomSlug: "slug-r1", locked: false });
    expect(await arrives(chidi, "room:locked")).toBe(false);

    // Ending reaches everyone with a seat or an invite, including people who left.
    const ended = once(chidi, "room:ended");
    await h.postEvent(room("ended"));
    expect(await ended).toEqual({ roomSlug: "slug-r1" });

    // A removed person hears about it too, even though they are no longer inside.
    const removed = once(chidi, "room:member_updated");
    await h.postEvent(room("member", { userId: "chidi" }));
    expect(await removed).toMatchObject({ userId: "chidi", state: "REMOVED" });
  });

  it("refuses room events without the service token and ignores unknown rooms", async () => {
    expect(await h.postEvent(room("settings"), "")).toBe(401);
    expect(await h.postEvent(room("settings"), "x".repeat(40))).toBe(401);
    expect(await h.postEvent(room("nonsense"))).toBe(400);
    const ada = await h.client("ada");
    await h.postEvent({ type: "room", roomId: "missing", change: "settings" });
    expect(await arrives(ada, "room:settings")).toBe(false);
  });
});

describe("health", () => {
  it("reports uptime and connected sockets without any user data", async () => {
    await h.client("bayo");
    const body = (await (await fetch(`${h.url}/health`)).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, service: "realtime", online: 1, sockets: 1 });
    expect(typeof body.uptimeSec).toBe("number");
    expect(typeof body.startedAt).toBe("string");
    expect(JSON.stringify(body)).not.toContain("bayo");
  });
});
