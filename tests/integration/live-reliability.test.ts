import { createHash, createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb, testDbEnabled } from "../helpers/db";

prepareTestEnv();
// Nothing listens here, so LiveKit and realtime calls fail fast and the database logic is what gets tested.
if (testDbEnabled) {
  process.env.LIVEKIT_URL = "http://nothing-listens.invalid";
  process.env.LIVEKIT_API_KEY = "test_key";
  process.env.LIVEKIT_API_SECRET = "s".repeat(40);
  process.env.REALTIME_URL = "http://nothing-listens.invalid";
}

async function load() {
  const [rooms, calls, friends, db, webhook] = await Promise.all([
    import("../../apps/web/src/server/rooms/service"),
    import("../../apps/web/src/server/calls/service"),
    import("../../apps/web/src/server/friends/service"),
    import("@gistroom/db"),
    import("../../apps/web/src/app/api/livekit/webhook/route"),
  ]);
  return { rooms, calls, friends, webhook, db: db.getDb() };
}

describe.skipIf(!testDbEnabled)("live reliability", () => {
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
  const input = (over: Record<string, unknown> = {}) => ({
    title: "Match talk",
    topicSlug: "football",
    language: "ENGLISH" as const,
    visibility: "PUBLIC" as const,
    media: "AUDIO" as const,
    description: null,
    scheduledFor: null,
    ...over,
  });
  async function liveRoom(host: Awaited<ReturnType<typeof person>>, over = {}) {
    const room = await m.rooms.createRoom(host, input(over));
    await m.rooms.joinRoom(host, room.slug);
    return room;
  }
  const ago = (ms: number) => new Date(Date.now() - ms);

  // ---------- Rooms ----------

  it("marks a person who went quiet as left, with their seat held for the grace period", async () => {
    const host = await person("h1");
    const guest = await person("g1");
    const room = await liveRoom(host);
    await m.rooms.joinRoom(guest, room.slug);
    await m.db.roomMember.updateMany({
      where: { userId: guest.id },
      data: { heartbeatAt: ago(60_000) },
    });
    const out = await m.rooms.reconcileLiveRooms();
    expect(out.left).toBe(1);
    const row = await m.db.roomMember.findFirst({ where: { userId: guest.id } });
    expect(row?.state).toBe("LEFT");
    expect(row?.graceUntil?.getTime()).toBeGreaterThan(Date.now());
    // They can take the seat back by joining again, and the view says the seat is theirs.
    expect((await m.rooms.viewRoom(guest, room.slug)).state).toBe("OK");
    const back = await m.rooms.joinRoom(guest, room.slug);
    expect(back.role).toBe("MEMBER");
  });

  it("keeps people who are still sending heartbeats", async () => {
    const host = await person("h2");
    const guest = await person("g2");
    const room = await liveRoom(host);
    await m.rooms.joinRoom(guest, room.slug);
    await m.rooms.heartbeatRoom(guest, room.slug);
    const out = await m.rooms.reconcileLiveRooms();
    expect(out.left).toBe(0);
  });

  it("hands the room on only after a dropped host's grace period has passed", async () => {
    const host = await person("h3");
    const guest = await person("g3");
    const room = await liveRoom(host);
    await m.rooms.joinRoom(guest, room.slug);
    await m.db.roomMember.updateMany({
      where: { userId: host.id },
      data: { heartbeatAt: ago(60_000) },
    });
    await m.rooms.heartbeatRoom(guest, room.slug);
    let out = await m.rooms.reconcileLiveRooms();
    expect(out.left).toBe(1);
    expect(out.handedOver).toBe(0);
    expect((await m.db.room.findUnique({ where: { slug: room.slug } }))?.hostId).toBe(host.id);
    // The grace period is over.
    await m.db.roomMember.updateMany({
      where: { userId: host.id },
      data: { graceUntil: ago(1000) },
    });
    out = await m.rooms.reconcileLiveRooms();
    expect(out.handedOver).toBe(1);
    expect((await m.db.room.findUnique({ where: { slug: room.slug } }))?.hostId).toBe(guest.id);
  });

  it("ends a room nobody has been in for five minutes, and never one that is just quiet for a moment", async () => {
    const host = await person("h4");
    const room = await liveRoom(host);
    await m.db.roomMember.updateMany({
      where: { userId: host.id },
      data: { heartbeatAt: ago(60_000) },
    });
    await m.rooms.reconcileLiveRooms();
    let row = await m.db.room.findUnique({ where: { slug: room.slug } });
    expect(row?.status).toBe("LIVE");
    expect(row?.emptySince).not.toBeNull();
    await m.db.room.update({ where: { slug: room.slug }, data: { emptySince: ago(6 * 60_000) } });
    const out = await m.rooms.reconcileLiveRooms();
    expect(out.ended).toBe(1);
    row = await m.db.room.findUnique({ where: { slug: room.slug } });
    expect(row?.status).toBe("ENDED");
  });

  it("warns the host before the longest allowed length and ends the room at it", async () => {
    const host = await person("h5");
    const room = await liveRoom(host);
    await m.rooms.heartbeatRoom(host, room.slug);
    await m.db.room.update({
      where: { slug: room.slug },
      data: { startedAt: ago((8 * 60 - 10) * 60_000) },
    });
    await m.rooms.reconcileLiveRooms();
    expect(
      (await m.db.room.findUnique({ where: { slug: room.slug } }))?.longWarnedAt,
    ).not.toBeNull();
    // The notice is sent in the background, so give it a moment.
    await new Promise((r) => setTimeout(r, 1500));
    expect(await m.db.notification.count({ where: { userId: host.id, type: "SYSTEM" } })).toBe(1);
    await m.db.room.update({ where: { slug: room.slug }, data: { startedAt: ago(9 * 3_600_000) } });
    await m.rooms.heartbeatRoom(host, room.slug);
    const out = await m.rooms.reconcileLiveRooms();
    expect(out.ended).toBe(1);
  });

  it("cancels a scheduled room whose host never came and tells the people on its list", async () => {
    const host = await person("h6");
    const guest = await person("g6");
    const room = await m.rooms.createRoom(
      host,
      input({ scheduledFor: new Date(Date.now() + 3_600_000).toISOString() }),
    );
    await m.rooms.setGoing(guest, room.slug, true);
    await m.db.room.update({
      where: { slug: room.slug },
      data: { scheduledFor: ago(45 * 60_000) },
    });
    expect(await m.rooms.cancelNoShowRooms()).toBe(1);
    expect((await m.db.room.findUnique({ where: { slug: room.slug } }))?.status).toBe("ENDED");
    await new Promise((r) => setTimeout(r, 1500));
    expect(await m.db.notification.count({ where: { userId: guest.id, type: "SYSTEM" } })).toBe(1);
    // Done once.
    expect(await m.rooms.cancelNoShowRooms()).toBe(0);
  });

  it("rings an invited friend, once every 30 seconds and three times per room", async () => {
    const host = await person("h7");
    const friends = await Promise.all(["a7", "b7", "c7", "d7"].map(person));
    for (const f of friends) await befriend(host, f);
    const room = await liveRoom(host);
    for (const f of friends) {
      await m.db.roomMember.create({
        data: { roomId: room.id, userId: f.id, state: "INVITED" },
      });
    }
    const first = friends[0]!;
    const r = await m.rooms.ringMember(host, room.slug, first.id);
    expect(r.status).toBe("RINGING");
    expect(
      await m.db.notification.count({ where: { userId: first.id, type: "ROOM_INVITE" } }),
    ).toBe(1);
    await expect(m.rooms.ringMember(host, room.slug, first.id)).rejects.toMatchObject({
      status: 429,
    });
    await m.rooms.ringMember(host, room.slug, friends[1]!.id);
    await m.rooms.ringMember(host, room.slug, friends[2]!.id);
    await expect(m.rooms.ringMember(host, room.slug, friends[3]!.id)).rejects.toMatchObject({
      status: 429,
    });
  });

  it("turns an unanswered ring into No answer, and lets a person decline or stop rings", async () => {
    const host = await person("h8");
    const a = await person("a8");
    const b = await person("b8");
    await befriend(host, a);
    await befriend(host, b);
    const room = await liveRoom(host);
    for (const f of [a, b]) {
      await m.db.roomMember.create({ data: { roomId: room.id, userId: f.id, state: "INVITED" } });
    }
    await m.rooms.ringMember(host, room.slug, a.id);
    await m.db.roomMember.updateMany({ where: { userId: a.id }, data: { ringedAt: ago(60_000) } });
    expect(await m.rooms.expireRings()).toBe(1);
    expect((await m.db.roomMember.findFirst({ where: { userId: a.id } }))?.ringStatus).toBe(
      "NO_ANSWER",
    );

    await m.rooms.ringMember(host, room.slug, b.id);
    await m.rooms.answerRing(b, room.slug, { noRing: true });
    expect((await m.db.roomMember.findFirst({ where: { userId: b.id } }))?.ringStatus).toBe(
      "DECLINED",
    );
    await expect(m.rooms.ringMember(host, room.slug, b.id)).rejects.toMatchObject({ status: 409 });
  });

  it("does not ring someone who is already inside, a stranger, or a private room's outsider", async () => {
    const host = await person("h9");
    const inside = await person("i9");
    const stranger = await person("s9");
    await befriend(host, inside);
    const room = await liveRoom(host);
    await m.rooms.joinRoom(inside, room.slug);
    await expect(m.rooms.ringMember(host, room.slug, inside.id)).rejects.toMatchObject({
      status: 409,
    });
    await expect(m.rooms.ringMember(host, room.slug, stranger.id)).rejects.toMatchObject({
      status: 403,
    });
    const secret = await liveRoom(host, { visibility: "PRIVATE", title: "Secret" });
    const friend = await person("f9");
    await befriend(host, friend);
    await expect(m.rooms.ringMember(host, secret.slug, friend.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("gives the last seat to exactly one of two people who ask at once", async () => {
    const host = await person("h10");
    const a = await person("a10");
    const b = await person("b10");
    const c = await person("c10");
    const room = await liveRoom(host);
    await m.db.room.update({ where: { slug: room.slug }, data: { maxParticipants: 2 } });
    await m.rooms.joinRoom(a, room.slug);
    const results = await Promise.allSettled([
      m.rooms.joinRoom(b, room.slug),
      m.rooms.joinRoom(c, room.slug),
    ]);
    // Host and a hold two seats already, so the third seat does not exist. Neither of the two gets it.
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(0);
    await m.db.room.update({ where: { slug: room.slug }, data: { maxParticipants: 3 } });
    const second = await Promise.allSettled([
      m.rooms.joinRoom(b, room.slug),
      m.rooms.joinRoom(c, room.slug),
    ]);
    expect(second.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await m.db.roomMember.count({ where: { roomId: room.id, state: "JOINED" } })).toBe(3);
  });

  it("lets only one of two people use a link that has one use", async () => {
    const host = await person("h11");
    const a = await person("a11");
    const b = await person("b11");
    const room = await liveRoom(host, { visibility: "PRIVATE" });
    const made = await m.rooms.createInviteLink(host, room.slug, { hours: 24, maxUses: 1 });
    const token = new URL(made.url).searchParams.get("invite") as string;
    const results = await Promise.allSettled([
      m.rooms.joinRoom(a, room.slug, token),
      m.rooms.joinRoom(b, room.slug, token),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("makes a removed person wait, takes their chat off the screen and never lets a banned person back", async () => {
    const host = await person("h12");
    const guest = await person("g12");
    const other = await person("o12");
    const room = await liveRoom(host);
    await m.rooms.joinRoom(guest, room.slug);
    await m.rooms.joinRoom(other, room.slug);
    const said = await m.rooms.postRoomMessage(guest, room.slug, {
      clientId: "client-1201",
      body: "hi",
    });
    await m.rooms.moderate(host, room.slug, { action: "REMOVE", userId: guest.id });
    await expect(m.rooms.joinRoom(guest, room.slug)).rejects.toMatchObject({ status: 403 });
    const seen = (await m.rooms.listRoomMessages(other, room.slug, null)).items.find(
      (x) => x.id === said.id,
    );
    expect(seen).toMatchObject({ deleted: "BY_OTHER", body: "" });
    // After the wait they can come back.
    await m.db.roomMember.updateMany({
      where: { userId: guest.id },
      data: { leftAt: ago(11 * 60_000) },
    });
    await expect(m.rooms.joinRoom(guest, room.slug)).resolves.toBeTruthy();
    await m.rooms.moderate(host, room.slug, { action: "BAN", userId: guest.id });
    await m.db.roomMember.updateMany({
      where: { userId: guest.id },
      data: { leftAt: ago(60 * 60_000) },
    });
    await expect(m.rooms.joinRoom(guest, room.slug)).rejects.toMatchObject({ status: 403 });
  });

  it("does not show a late joiner what was said before they came", async () => {
    const host = await person("h13");
    const late = await person("l13");
    const room = await liveRoom(host);
    await m.rooms.postRoomMessage(host, room.slug, { clientId: "client-1301", body: "before" });
    await new Promise((r) => setTimeout(r, 30));
    await m.rooms.joinRoom(late, room.slug);
    await m.rooms.postRoomMessage(host, room.slug, { clientId: "client-1302", body: "after" });
    const seen = await m.rooms.listRoomMessages(late, room.slug, null);
    expect(seen.items.map((x) => x.body)).toEqual(["after"]);
  });

  it("lets a person who dropped see that their seat is still theirs", async () => {
    const host = await person("h14");
    const guest = await person("g14");
    const room = await liveRoom(host);
    await m.rooms.joinRoom(guest, room.slug);
    await m.rooms.leaveRoom(guest, room.slug, { dropped: true });
    const view = await m.rooms.viewRoom(guest, room.slug);
    expect(view.state === "OK" && view.room.rejoin).toBe(true);
    await m.db.roomMember.updateMany({
      where: { userId: guest.id },
      data: { graceUntil: ago(1000) },
    });
    const late = await m.rooms.viewRoom(guest, room.slug);
    expect(late.state === "OK" && late.room.rejoin).toBe(false);
  });

  it("lists invited people with how the ring went, to people who can invite", async () => {
    const host = await person("h15");
    const mod = await person("m15");
    const plain = await person("p15");
    const invited = await person("i15");
    await befriend(host, invited);
    const room = await liveRoom(host);
    await m.rooms.joinRoom(plain, room.slug);
    await m.db.roomMember.create({
      data: { roomId: room.id, userId: invited.id, state: "INVITED" },
    });
    await m.rooms.ringMember(host, room.slug, invited.id);
    const forHost = await m.rooms.listMembers(host, room.slug);
    expect(forHost.find((x) => x.user.id === invited.id)?.ringStatus).toBe("RINGING");
    const forPlain = await m.rooms.listMembers(plain, room.slug);
    expect(forPlain.some((x) => x.user.id === invited.id)).toBe(false);
    void mod;
  });

  // ---------- Calls ----------

  async function conversationBetween(a: { id: string }, b: { id: string }) {
    await befriend(a, b);
    return m.friends.ensureConversation(a.id, b.id);
  }

  it("ends an active call when one side has been silent for a minute", async () => {
    const a = await person("a20");
    const b = await person("b20");
    const conv = await conversationBetween(a, b);
    const started = await m.calls.startCall(a, { conversationId: conv, media: "AUDIO" });
    await m.calls.acceptCall(b, started.call.id);
    const answered = new Date(Date.now() - 5 * 60_000);
    await m.db.call.update({
      where: { id: started.call.id },
      data: { answeredAt: answered, callerSeenAt: new Date(), calleeSeenAt: ago(90_000) },
    });
    expect(await m.calls.reconcileStuckCalls()).toBe(1);
    const row = await m.db.call.findUnique({ where: { id: started.call.id } });
    expect(row?.status).toBe("ENDED");
    expect(row?.endReason).toBe("peer-gone");
    expect(row?.endedById).toBeNull();
  });

  it("keeps a call whose sides both keep saying they are there", async () => {
    const a = await person("a21");
    const b = await person("b21");
    const conv = await conversationBetween(a, b);
    const started = await m.calls.startCall(a, { conversationId: conv, media: "AUDIO" });
    await m.calls.acceptCall(b, started.call.id);
    await m.db.call.update({
      where: { id: started.call.id },
      data: { answeredAt: ago(5 * 60_000) },
    });
    await m.calls.heartbeatCall(a, started.call.id);
    await m.calls.heartbeatCall(b, started.call.id);
    expect(await m.calls.reconcileStuckCalls()).toBe(0);
  });

  it("records who ended a call on purpose", async () => {
    const a = await person("a22");
    const b = await person("b22");
    const conv = await conversationBetween(a, b);
    const started = await m.calls.startCall(a, { conversationId: conv, media: "AUDIO" });
    await m.calls.acceptCall(b, started.call.id);
    const ended = await m.calls.endCall(b, started.call.id);
    expect(ended.call.endedBy).toBe("ME");
    const forA = await m.calls.getCall(a, started.call.id);
    expect(forA.call.endedBy).toBe("PEER");
  });

  it("ends a call quietly when one person blocks the other", async () => {
    const a = await person("a23");
    const b = await person("b23");
    const conv = await conversationBetween(a, b);
    const started = await m.calls.startCall(a, { conversationId: conv, media: "AUDIO" });
    await m.calls.acceptCall(b, started.call.id);
    await m.friends.blockUser(b, a.id);
    const row = await m.db.call.findUnique({ where: { id: started.call.id } });
    expect(row?.status).toBe("ENDED");
    expect(row?.endReason).toBe("blocked");
    const forA = await m.calls.getCall(a, started.call.id);
    expect(forA.call.endedBy).toBe("SYSTEM");
  });

  it("creates one call when Call is pressed twice at once", async () => {
    const a = await person("a24");
    const b = await person("b24");
    const conv = await conversationBetween(a, b);
    const results = await Promise.allSettled([
      m.calls.startCall(a, { conversationId: conv, media: "AUDIO" }),
      m.calls.startCall(a, { conversationId: conv, media: "AUDIO" }),
    ]);
    const ids = new Set(
      results.flatMap((r) => (r.status === "fulfilled" ? [r.value.call.id] : [])),
    );
    expect(ids.size).toBeLessThanOrEqual(1);
    expect(await m.db.call.count({ where: { callerId: a.id } })).toBe(1);
  });

  it("tells a caller the person is busy in a room, and leaves a quiet note for the person in the room", async () => {
    const a = await person("a25");
    const b = await person("b25");
    const conv = await conversationBetween(a, b);
    const room = await liveRoom(b);
    expect(room.slug).toBeTruthy();
    await expect(
      m.calls.startCall(a, { conversationId: conv, media: "AUDIO" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await m.db.notification.count({ where: { userId: b.id, type: "CALL_MISSED" } })).toBe(1);
    const entry = await m.db.callLogEntry.findFirst({ where: { userId: b.id } });
    expect(entry?.outcome).toBe("MISSED");
  });

  it("says whether the person being called can see it at all", async () => {
    const a = await person("a26");
    const b = await person("b26");
    const conv = await conversationBetween(a, b);
    await m.db.user.update({ where: { id: b.id }, data: { lastSeenAt: ago(60 * 60_000) } });
    const started = await m.calls.startCall(a, { conversationId: conv, media: "AUDIO" });
    expect(started.call.peerReachable).toBe(false);
  });

  // ---------- LiveKit webhook ----------

  function signed(body: string) {
    const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const p = Buffer.from(
      JSON.stringify({
        iss: "test_key",
        exp: Math.floor(Date.now() / 1000) + 60,
        sha256: createHash("sha256").update(body).digest("base64"),
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", "s".repeat(40)).update(`${h}.${p}`).digest("base64url");
    return `${h}.${p}.${sig}`;
  }
  const hook = (body: string, auth: string | null) =>
    m.webhook.POST(
      new Request("http://localhost:3000/api/livekit/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/webhook+json",
          ...(auth ? { authorization: auth } : {}),
        },
        body,
      }) as never,
      {} as never,
    );

  it("refuses an unsigned webhook and handles a repeated delivery once", async () => {
    const body = JSON.stringify({
      event: "participant_joined",
      id: "evt-1",
      room: { name: "room_x" },
    });
    const refused = await hook(body, null);
    expect(refused.status).toBe(401);
    const first = await hook(body, signed(body));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true });
    const second = await hook(body, signed(body));
    expect(await second.json()).toMatchObject({ duplicate: true });
    expect(await m.db.liveKitEvent.count({ where: { id: "evt-1" } })).toBe(1);
  });

  it("copes with events that arrive out of order, because it reads the truth instead of the event", async () => {
    const host = await person("h30");
    const guest = await person("g30");
    const room = await liveRoom(host);
    await m.rooms.joinRoom(guest, room.slug);
    const row = await m.db.room.findUnique({ where: { slug: room.slug } });
    // "left" arrives for a person who then rejoined: their recent heartbeat keeps them in.
    await m.rooms.heartbeatRoom(guest, room.slug);
    const left = JSON.stringify({
      event: "participant_left",
      id: "evt-2",
      room: { name: row?.livekitRoom },
      participant: { identity: `user_${guest.id}` },
    });
    await hook(left, signed(left));
    expect((await m.db.roomMember.findFirst({ where: { userId: guest.id } }))?.state).toBe(
      "JOINED",
    );
  });
});
