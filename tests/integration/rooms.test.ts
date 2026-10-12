import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";

prepareTestEnv();
// Nothing listens here, so LiveKit and realtime calls fail fast and the rooms logic is what gets tested.
if (testDbEnabled) {
  process.env.LIVEKIT_URL = "http://nothing-listens.invalid";
  process.env.LIVEKIT_API_KEY = "test_key";
  process.env.LIVEKIT_API_SECRET = "s".repeat(40);
  process.env.REALTIME_URL = "http://nothing-listens.invalid";
}

async function load() {
  const [rooms, db] = await Promise.all([
    import("../../apps/web/src/server/rooms/service"),
    import("@gistroom/db"),
  ]);
  return { ...rooms, db: db.getDb() };
}

describe.skipIf(!testDbEnabled)("rooms", () => {
  let m: Awaited<ReturnType<typeof load>>;
  beforeAll(async () => {
    m = await load();
  });
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await resetTestDb();
  });

  async function person(key: string) {
    return m.db.user.create({
      data: {
        email: `test_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_${key}`,
        onboardedAt: new Date(),
      },
    });
  }

  async function befriend(a: { id: string }, b: { id: string }) {
    const [low, high] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
  }

  async function liveRoom(host: Awaited<ReturnType<typeof person>>, visibility = "PUBLIC") {
    const room = await m.createRoom(host, {
      title: "Match talk",
      topicSlug: "football",
      language: "ENGLISH",
      visibility: visibility as "PUBLIC" | "PRIVATE",
      media: "VIDEO",
      description: null,
      scheduledFor: null,
    });
    await m.joinRoom(host, room.slug);
    return room;
  }

  it("creates a room with its type and the default settings", async () => {
    const host = await person("h1");
    const room = await liveRoom(host);
    expect(room.media).toBe("VIDEO");
    expect(room.topicSlug).toBe("football");
    expect(room.settings).toMatchObject({
      cameraAllowed: true,
      joinMuted: false,
      chatMode: "EVERYONE",
      reactionsOn: true,
      slowModeSec: 0,
      membersCanShare: true,
      unmuteLocked: false,
    });
  });

  it("lets the host and moderators change settings, logs it, and refuses plain members", async () => {
    const host = await person("s1");
    const mod = await person("s2");
    const member = await person("s3");
    const room = await liveRoom(host);
    await m.joinRoom(mod, room.slug);
    await m.joinRoom(member, room.slug);
    await m.moderate(host, room.slug, { action: "PROMOTE", userId: mod.id });

    const changed = await m.updateSettings(mod, room.slug, {
      title: "Renamed",
      chatMode: "MODERATORS",
      slowModeSec: 15,
      reactionsOn: false,
      visibility: "PRIVATE",
    });
    expect(changed.title).toBe("Renamed");
    expect(changed.settings.chatMode).toBe("MODERATORS");
    expect(changed.settings.slowModeSec).toBe(15);
    expect(changed.visibility).toBe("PRIVATE");

    await expect(m.updateSettings(member, room.slug, { reactionsOn: true })).rejects.toMatchObject({
      status: 403,
    });
    const log = await m.db.roomModLog.findMany({ where: { action: "SETTINGS" } });
    expect(log).toHaveLength(1);
  });

  it("keeps room chat to its rules: mode, slow mode, own and moderator deletes", async () => {
    const host = await person("c1");
    const member = await person("c2");
    const other = await person("c3");
    const room = await liveRoom(host);
    await m.joinRoom(member, room.slug);
    await m.joinRoom(other, room.slug);

    const first = await m.postRoomMessage(member, room.slug, {
      clientId: "client-0001",
      body: "hi",
    });
    expect(first.senderRole).toBe("MEMBER");
    const hostSays = await m.postRoomMessage(host, room.slug, {
      clientId: "client-0002",
      body: "yo",
    });
    expect(hostSays.senderRole).toBe("HOST");

    await m.updateSettings(host, room.slug, { slowModeSec: 30 });
    await expect(
      m.postRoomMessage(member, room.slug, { clientId: "client-0003", body: "again" }),
    ).rejects.toMatchObject({ status: 429 });
    // Moderators are not slowed.
    await m.postRoomMessage(host, room.slug, { clientId: "client-0004", body: "still me" });

    await m.updateSettings(host, room.slug, { slowModeSec: 0, chatMode: "MODERATORS" });
    await expect(
      m.postRoomMessage(other, room.slug, { clientId: "client-0005", body: "hello" }),
    ).rejects.toMatchObject({ status: 403 });
    await m.updateSettings(host, room.slug, { chatMode: "OFF" });
    await expect(
      m.postRoomMessage(host, room.slug, { clientId: "client-0006", body: "anyone" }),
    ).rejects.toMatchObject({ status: 403 });
    await m.updateSettings(host, room.slug, { chatMode: "EVERYONE" });

    // A member deletes their own message, but not someone else's. A moderator deletes any.
    await expect(m.deleteRoomMessage(other, room.slug, hostSays.id)).rejects.toMatchObject({
      status: 403,
    });
    await m.deleteRoomMessage(member, room.slug, first.id);
    await m.deleteRoomMessage(host, room.slug, hostSays.id);
    const left = await m.db.roomMessage.count({ where: { id: { in: [first.id, hostSays.id] } } });
    expect(left).toBe(0);
  });

  it("toggles a reaction on a chat message and counts it for the summary", async () => {
    const host = await person("r1");
    const member = await person("r2");
    const room = await liveRoom(host);
    await m.joinRoom(member, room.slug);
    const msg = await m.postRoomMessage(host, room.slug, { clientId: "client-0101", body: "gist" });
    const clap = "\u{1F44F}";
    await m.reactToRoomMessage(member, room.slug, msg.id, clap);
    let page = await m.listRoomMessages(host, room.slug, null);
    expect(page.items[0]?.reactions).toEqual([{ emoji: clap, count: 1, mine: false }]);
    await m.reactToRoomMessage(member, room.slug, msg.id, clap);
    page = await m.listRoomMessages(host, room.slug, null);
    expect(page.items[0]?.reactions).toEqual([]);

    await expect(m.reactToRoomMessage(member, room.slug, msg.id, "x")).rejects.toMatchObject({
      status: 400,
    });
    await m.sendRoomReaction(member, room.slug, clap);
    await m.updateSettings(host, room.slug, { reactionsOn: false });
    await expect(m.sendRoomReaction(member, room.slug, clap)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("deletes the chat when the room ends and keeps the summary numbers", async () => {
    const host = await person("e1");
    const guest = await person("e2");
    const outsider = await person("e3");
    const room = await liveRoom(host);
    await m.joinRoom(guest, room.slug);
    await m.postRoomMessage(guest, room.slug, { clientId: "client-0201", body: "one" });
    await m.postRoomMessage(host, room.slug, { clientId: "client-0202", body: "two" });
    await m.sendRoomReaction(guest, room.slug, "\u{1F525}");
    await m.endRoom(host, room.slug);

    expect(await m.db.roomMessage.count({ where: { roomId: room.id } })).toBe(0);
    const forHost = await m.roomSummary(host, room.slug);
    expect(forHost).toMatchObject({
      messageCount: 2,
      reactionCount: 1,
      attendeeCount: 2,
      peakParticipants: 2,
      attended: true,
    });
    expect(forHost.attendees?.map((p) => p.id).sort()).toEqual([host.id, guest.id].sort());
    expect(forHost.modActionCount).not.toBeNull();

    const forGuest = await m.roomSummary(guest, room.slug);
    expect(forGuest.modActionCount).toBeNull();
    expect(forGuest.attendees).not.toBeNull();

    // Anyone can see the numbers of a public room, but not who came.
    const forOutsider = await m.roomSummary(outsider, room.slug);
    expect(forOutsider.attendees).toBeNull();
    expect(forOutsider.attended).toBe(false);
    expect(forOutsider.notes).toEqual([]);

    const past = await m.pastRooms(guest);
    expect(past.map((r) => r.slug)).toEqual([room.slug]);
    expect(await m.pastRooms(outsider)).toEqual([]);
  });

  it("hides a private ended room from people who were not in it", async () => {
    const host = await person("p1");
    const outsider = await person("p2");
    const room = await liveRoom(host, "PRIVATE");
    await m.endRoom(host, room.slug);
    await expect(m.roomSummary(outsider, room.slug)).rejects.toMatchObject({ status: 404 });
  });

  it("shows active invite links in full and stops a revoked one at once", async () => {
    const host = await person("l1");
    const guest = await person("l2");
    const room = await liveRoom(host, "PRIVATE");
    const link = await m.createInviteLink(host, room.slug, { hours: 12 });
    const token = new URL(link.url).searchParams.get("invite") ?? "";
    expect(link.url).toContain(`/rooms/${room.slug}?invite=`);

    const listed = await m.listInviteLinks(host, room.slug);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.url).toBe(link.url);

    expect((await m.viewRoom(guest, room.slug, token)).state).toBe("OK");
    await m.revokeInviteLink(host, room.slug, link.id);
    expect(await m.listInviteLinks(host, room.slug)).toEqual([]);
    expect((await m.viewRoom(guest, room.slug, token)).state).toBe("LINK_INVALID");
    await expect(m.joinRoom(guest, room.slug, token)).rejects.toMatchObject({ status: 403 });
  });

  it("lets members of a public room share its link unless the host turns that off", async () => {
    const host = await person("m1");
    const member = await person("m2");
    const room = await liveRoom(host);
    await m.joinRoom(member, room.slug);
    expect((await m.roomShareLink(member, room.slug)).url).toContain(`/rooms/${room.slug}`);
    // Members share the plain room link. Expiring invite links are for the host and moderators.
    await expect(m.createInviteLink(member, room.slug, { hours: 1 })).rejects.toMatchObject({
      status: 403,
    });
    await m.updateSettings(host, room.slug, { membersCanShare: false });
    expect((await m.roomShareLink(member, room.slug)).url).toBeNull();
    await expect(m.createInviteLink(member, room.slug, { hours: 1 })).rejects.toMatchObject({
      status: 403,
    });

    const priv = await liveRoom(await person("m3"), "PRIVATE");
    const invited = await person("m4");
    const roomRow = await m.db.room.findUniqueOrThrow({ where: { slug: priv.slug } });
    await m.db.roomMember.create({
      data: { roomId: roomRow.id, userId: invited.id, state: "JOINED", joinedAt: new Date() },
    });
    await expect(m.createInviteLink(invited, priv.slug, { hours: 1 })).rejects.toMatchObject({
      status: 403,
    });
    expect((await m.roomShareLink(invited, priv.slug)).url).toBeNull();
  });

  it("invites several friends with a card in each chat and a result per person", async () => {
    const host = await person("i1");
    const friend = await person("i2");
    const stranger = await person("i3");
    await befriend(host, friend);
    const room = await liveRoom(host, "PRIVATE");

    const results = await m.inviteFriends(host, room.slug, [friend.id, stranger.id]);
    expect(results.find((r) => r.userId === friend.id)?.ok).toBe(true);
    expect(results.find((r) => r.userId === stranger.id)?.ok).toBe(false);

    const cards = await m.db.message.findMany({ where: { type: "ROOM_INVITE" } });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.meta).toMatchObject({ roomSlug: room.slug, title: "Match talk" });
    // A private room adds the friend to its list too.
    const row = await m.db.roomMember.findFirst({ where: { userId: friend.id } });
    expect(row?.state).toBe("INVITED");
  });

  it("mute everyone with the lock flips unmuteLocked, and settings can switch it off", async () => {
    const host = await person("u1");
    const room = await liveRoom(host);
    await m.muteAll(host, room.slug, { lockUnmute: true });
    expect((await m.db.room.findUniqueOrThrow({ where: { slug: room.slug } })).unmuteLocked).toBe(
      true,
    );
    await m.updateSettings(host, room.slug, { unmuteLocked: false });
    expect((await m.db.room.findUniqueOrThrow({ where: { slug: room.slug } })).unmuteLocked).toBe(
      false,
    );
  });
});
