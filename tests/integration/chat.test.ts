import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();
// Nothing listens here, so realtime calls fail fast and the chat logic is what gets tested.
if (requireTestDb()) process.env.REALTIME_URL = "http://nothing-listens.invalid";

async function load() {
  const [chat, reports, notes, shared, db] = await Promise.all([
    import("../../apps/web/src/server/chat/service"),
    import("../../apps/web/src/server/chat/reports"),
    import("../../apps/web/src/server/notes/service"),
    import("@gistroom/shared"),
    import("@gistroom/db"),
  ]);
  return { ...chat, ...reports, ...notes, errors: shared.errors, db: db.getDb() };
}

const MIN = 60_000;

describe.skipIf(!requireTestDb())("chat messages, reports and notes", () => {
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
        email: `test_chat_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `testchat${key}`,
        onboardedAt: new Date(),
      },
    });
  }
  /** Two friends with their chat. */
  async function pair() {
    const ada = await person("ada");
    const bayo = await person("bayo");
    const [low, high] = ada.id < bayo.id ? [ada.id, bayo.id] : [bayo.id, ada.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
    const chat = await m.db.conversation.create({
      data: {
        dmKey: `${low}:${high}`,
        members: { create: [{ userId: ada.id }, { userId: bayo.id }] },
      },
    });
    return { ada, bayo, chat };
  }
  const say = (
    me: Awaited<ReturnType<typeof person>>,
    chatId: string,
    clientId: string,
    body = "hi there",
  ) => m.sendMessage(me, chatId, { clientId, type: "TEXT", body });
  async function failure(p: Promise<unknown>) {
    return p.then(
      () => {
        throw new Error("expected a failure");
      },
      (e: unknown) => e as { status: number; message: string },
    );
  }
  const age = (id: string, ms: number) =>
    m.db.message.update({ where: { id }, data: { createdAt: new Date(Date.now() - ms) } });

  // ---------- Sending ----------

  it("sends once per clientId, and a retry returns the first message with nothing sent twice", async () => {
    const { ada, bayo, chat } = await pair();
    const first = await say(ada, chat.id, "client-0001");
    expect(first.created).toBe(true);
    const retry = await say(ada, chat.id, "client-0001", "a different body");
    expect(retry.created).toBe(false);
    expect(retry.message.id).toBe(first.message.id);
    expect(retry.message.body).toBe("hi there");
    expect(await m.db.message.count()).toBe(1);
    // One notice for the receiver, and it counts up on the next message instead of adding rows.
    await say(ada, chat.id, "client-0002");
    const notices = await m.db.notification.findMany({
      where: { userId: bayo.id, type: "DM_MESSAGE" },
    });
    expect(notices).toHaveLength(1);
    expect((notices[0]?.payload as { count: number }).count).toBe(2);
  });

  it("keeps a clientId inside its own chat", async () => {
    const { ada, chat } = await pair();
    const chidi = await person("chidi");
    const [low, high] = ada.id < chidi.id ? [ada.id, chidi.id] : [chidi.id, ada.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
    const other = await m.db.conversation.create({
      data: {
        dmKey: `${low}:${high}`,
        members: { create: [{ userId: ada.id }, { userId: chidi.id }] },
      },
    });
    await say(ada, chat.id, "client-0001");
    expect((await failure(say(ada, other.id, "client-0001"))).status).toBe(404);
  });

  it("refuses strangers, non friends, blocked people and bad bodies", async () => {
    const { ada, bayo, chat } = await pair();
    const stranger = await person("stranger");
    expect((await failure(say(stranger, chat.id, "client-0001"))).status).toBe(404);
    expect((await failure(m.getMessages(stranger, chat.id, null, 20))).status).toBe(404);

    expect((await failure(say(ada, chat.id, "client-0002", "   "))).status).toBe(400);
    expect((await failure(say(ada, chat.id, "client-0003", "x".repeat(4001)))).status).toBe(400);

    await m.db.block.create({ data: { blockerId: bayo.id, blockedId: ada.id } });
    expect(await failure(say(ada, chat.id, "client-0004"))).toMatchObject({
      status: 403,
      message: m.errors.chatUnavailable,
    });
    await m.db.block.deleteMany();
    await m.db.friendship.deleteMany();
    expect(await failure(say(ada, chat.id, "client-0005"))).toMatchObject({
      status: 403,
      message: m.errors.notFriends,
    });
    expect(await m.db.message.count()).toBe(0);
  });

  it("replies only to a message in the same chat", async () => {
    const { ada, bayo, chat } = await pair();
    const first = await say(bayo, chat.id, "client-0001", "question");
    const reply = await m.sendMessage(ada, chat.id, {
      clientId: "client-0002",
      type: "TEXT",
      body: "answer",
      replyToId: first.message.id,
    });
    expect(reply.message.replyPreview?.body).toBe("question");
    expect(
      (
        await failure(
          m.sendMessage(ada, chat.id, {
            clientId: "client-0003",
            type: "TEXT",
            body: "x",
            replyToId: "no_such_message",
          }),
        )
      ).status,
    ).toBe(404);
  });

  it("does not notify someone who muted the chat", async () => {
    const { ada, bayo, chat } = await pair();
    await m.setMuted(bayo, chat.id, new Date(Date.now() + 60 * MIN));
    await say(ada, chat.id, "client-0001");
    expect(await m.db.notification.count({ where: { userId: bayo.id, type: "DM_MESSAGE" } })).toBe(
      0,
    );
    await m.setMuted(bayo, chat.id, null);
    await say(ada, chat.id, "client-0002");
    expect(await m.db.notification.count({ where: { userId: bayo.id, type: "DM_MESSAGE" } })).toBe(
      1,
    );
  });

  // ---------- Reading ----------

  it("pages newest first with a cursor and no repeats", async () => {
    const { ada, chat } = await pair();
    for (let i = 1; i <= 5; i += 1) {
      const sent = await say(ada, chat.id, `client-000${i}`, `m${i}`);
      await age(sent.message.id, (6 - i) * MIN);
    }
    const first = await m.getMessages(ada, chat.id, null, 2);
    const second = await m.getMessages(ada, chat.id, first.nextCursor, 2);
    const third = await m.getMessages(ada, chat.id, second.nextCursor, 2);
    expect(first.items.map((x) => x.body)).toEqual(["m5", "m4"]);
    expect(second.items.map((x) => x.body)).toEqual(["m3", "m2"]);
    expect(third.items.map((x) => x.body)).toEqual(["m1"]);
    expect(third.nextCursor).toBeNull();
  });

  // ---------- Deleting and editing ----------

  it("hides a message for one person only when deleted for me", async () => {
    const { ada, bayo, chat } = await pair();
    const sent = await say(ada, chat.id, "client-0001", "secret");
    await m.deleteForMe(bayo, sent.message.id);
    expect((await m.getMessages(bayo, chat.id, null, 20)).items).toHaveLength(0);
    expect((await m.getMessages(ada, chat.id, null, 20)).items).toHaveLength(1);
    await m.deleteForMe(bayo, sent.message.id); // twice is harmless
  });

  it("lets only the sender delete for everyone, once, inside fifteen minutes", async () => {
    const { ada, bayo, chat } = await pair();
    const sent = await say(ada, chat.id, "client-0001", "oops");
    expect((await failure(m.deleteForEveryone(bayo, sent.message.id))).status).toBe(403);
    const gone = await m.deleteForEveryone(ada, sent.message.id);
    expect(gone.deletedForEveryone).toBe(true);
    expect(gone.body).toBeNull();
    expect((await failure(m.deleteForEveryone(ada, sent.message.id))).status).toBe(403);

    const old = await say(ada, chat.id, "client-0002", "too late");
    await age(old.message.id, 16 * MIN);
    expect(await failure(m.deleteForEveryone(ada, old.message.id))).toMatchObject({
      status: 403,
      message: m.errors.deleteWindowClosed,
    });
    const fresh = await say(ada, chat.id, "client-0003", "still fine");
    await age(fresh.message.id, 14 * MIN);
    expect((await m.deleteForEveryone(ada, fresh.message.id)).deletedForEveryone).toBe(true);
  });

  it("lets only the sender edit text inside fifteen minutes and marks it edited", async () => {
    const { ada, bayo, chat } = await pair();
    const sent = await say(ada, chat.id, "client-0001", "first draft");
    expect((await failure(m.editMessage(bayo, sent.message.id, "hijack"))).status).toBe(403);
    const edited = await m.editMessage(ada, sent.message.id, "  second draft  ");
    expect(edited.body).toBe("second draft");
    expect(edited.editedAt).not.toBeNull();
    // The same text again changes nothing.
    const again = await m.editMessage(ada, sent.message.id, "second draft");
    expect(again.editedAt).toBe(edited.editedAt);
    expect((await failure(m.editMessage(ada, sent.message.id, "   "))).status).toBe(400);

    await age(sent.message.id, 16 * MIN);
    expect(await failure(m.editMessage(ada, sent.message.id, "late"))).toMatchObject({
      status: 403,
      message: m.errors.editWindowClosed,
    });
    const voice = await m.sendMessage(ada, chat.id, {
      clientId: "client-0002",
      type: "VOICE",
      body: null,
      attachment: { storagePath: "dm/x/y/z.webm", mime: "audio/webm", sizeBytes: 10 },
    });
    expect(await failure(m.editMessage(ada, voice.message.id, "text"))).toMatchObject({
      status: 403,
      message: m.errors.editNotAllowed,
    });
  });

  // ---------- Stars and reactions ----------

  it("stars for one person only, lists starred messages, and stars survive unstarring cleanly", async () => {
    const { ada, bayo, chat } = await pair();
    const sent = await say(bayo, chat.id, "client-0001", "keep this");
    expect((await m.setStar(ada, sent.message.id, true)).starred).toBe(true);
    await m.setStar(ada, sent.message.id, true);
    expect(await m.db.messageStar.count()).toBe(1);
    expect((await m.starredMessages(ada, null, 20)).items.map((x) => x.body)).toEqual([
      "keep this",
    ]);
    expect((await m.starredMessages(bayo, null, 20)).items).toEqual([]);
    expect((await m.setStar(ada, sent.message.id, false)).starred).toBe(false);
    expect((await m.starredMessages(ada, null, 20)).items).toEqual([]);
    const stranger = await person("stranger");
    expect((await failure(m.setStar(stranger, sent.message.id, true))).status).toBe(404);
  });

  it("toggles a reaction on and off, and refuses text that is not one emoji", async () => {
    const { ada, bayo, chat } = await pair();
    const sent = await say(bayo, chat.id, "client-0001");
    const thumbs = "\u{1F44D}";
    const on = await m.toggleReaction(ada, sent.message.id, thumbs);
    expect(on.reactions.length).toBeGreaterThan(0);
    const off = await m.toggleReaction(ada, sent.message.id, thumbs);
    expect(off.reactions).toEqual([]);
    for (const bad of ["hello", "", "\u{1F44D}\u{1F44D}", "<b>"]) {
      expect((await failure(m.toggleReaction(ada, sent.message.id, bad))).status).toBe(400);
    }
  });

  // ---------- The chat itself ----------

  it("archives, unarchives and records an activity line with an undo", async () => {
    const { ada, bayo, chat } = await pair();
    await say(bayo, chat.id, "client-0001");
    await m.setArchived(ada, chat.id, true);
    expect((await m.listConversations(ada, false)).map((c) => c.id)).toEqual([]);
    expect((await m.listConversations(ada, true)).map((c) => c.id)).toEqual([chat.id]);
    expect(await m.db.notification.count({ where: { userId: ada.id, type: "ACTIVITY" } })).toBe(1);
    // A new message does not bring an archived chat back (D3), and the Archived row shows a dot.
    await say(bayo, chat.id, "client-0002");
    expect((await m.listConversations(ada, false)).map((c) => c.id)).toEqual([]);
    expect(await m.archivedUnreadCount(ada)).toBeGreaterThan(0);
    await m.setArchived(ada, chat.id, false);
    expect((await m.listConversations(ada, false)).map((c) => c.id)).toEqual([chat.id]);
  });

  it("clears a chat for one person: old history is gone for them, new messages bring it back", async () => {
    const { ada, bayo, chat } = await pair();
    const old = await say(bayo, chat.id, "client-0001", "old");
    await age(old.message.id, MIN);
    await m.clearChat(ada, chat.id);
    expect((await m.listConversations(ada, false)).map((c) => c.id)).toEqual([]);
    expect((await m.getMessages(ada, chat.id, null, 20)).items).toEqual([]);
    expect((await m.getMessages(bayo, chat.id, null, 20)).items).toHaveLength(1);
    await say(bayo, chat.id, "client-0002", "new");
    expect((await m.listConversations(ada, false)).map((c) => c.id)).toEqual([chat.id]);
    expect((await m.getMessages(ada, chat.id, null, 20)).items.map((x) => x.body)).toEqual(["new"]);
    const stranger = await person("stranger");
    expect((await failure(m.clearChat(stranger, chat.id))).status).toBe(404);
  });

  it("moves the receipt cursors forward and never back", async () => {
    const { ada, bayo, chat } = await pair();
    const one = await say(ada, chat.id, "client-0001");
    const two = await say(ada, chat.id, "client-0002");
    await age(one.message.id, 2 * MIN);
    await m.acknowledge(bayo, chat.id, two.message.id, "read");
    await m.acknowledge(bayo, chat.id, one.message.id, "read");
    const page = await m.getMessages(ada, chat.id, null, 20);
    expect(page.peer.readAt).not.toBeNull();
    const member = await m.db.conversationMember.findFirstOrThrow({
      where: { conversationId: chat.id, userId: bayo.id },
    });
    expect(member.lastReadMessageId).toBe(two.message.id);
    expect((await failure(m.acknowledge(bayo, chat.id, "no_such_message", "read"))).status).toBe(
      404,
    );
    expect(await m.getConversation(ada, chat.id)).toMatchObject({ id: chat.id });
  });

  // ---------- Reports ----------

  it("saves a report with the last twenty messages as evidence, even after a block", async () => {
    const { ada, bayo, chat } = await pair();
    // Written straight to the table, with times a minute apart, so the test is not 25 round trips.
    await m.db.message.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        conversationId: chat.id,
        senderId: bayo.id,
        clientId: `client-${String(i + 1).padStart(4, "0")}`,
        body: `m${i + 1}`,
        createdAt: new Date(Date.now() - (26 - i) * 60_000),
      })),
    });
    await m.db.block.create({ data: { blockerId: ada.id, blockedId: bayo.id } });
    const { id } = await m.reportChat(ada, chat.id, { reason: "HARASSMENT", details: " rude " });
    const report = await m.db.report.findUniqueOrThrow({ where: { id } });
    expect(report).toMatchObject({
      reporterId: ada.id,
      targetType: "USER",
      targetId: bayo.id,
      reason: "HARASSMENT",
      details: "rude",
    });
    const evidence = report.evidence as { messages: { body: string }[] };
    expect(evidence.messages).toHaveLength(m.EVIDENCE_COUNT);
    expect(evidence.messages.at(-1)?.body).toBe("m25");
  });

  it("reports one message, refuses a message from another chat, and refuses strangers", async () => {
    const { ada, bayo, chat } = await pair();
    const sent = await say(bayo, chat.id, "client-0001", "bad words");
    const one = await m.reportChat(ada, chat.id, { reason: "SPAM", messageId: sent.message.id });
    expect(await m.db.report.findUniqueOrThrow({ where: { id: one.id } })).toMatchObject({
      targetType: "MESSAGE",
      targetId: sent.message.id,
    });
    expect(
      (await failure(m.reportChat(ada, chat.id, { reason: "SPAM", messageId: "nope" }))).status,
    ).toBe(404);
    const stranger = await person("stranger");
    expect((await failure(m.reportChat(stranger, chat.id, { reason: "SPAM" }))).status).toBe(404);
    expect(await m.db.report.count()).toBe(1);
  });

  // ---------- Notes ----------

  it("keeps notes private to their author, in a chat the author is in", async () => {
    const { ada, bayo, chat } = await pair();
    const stranger = await person("stranger");
    const scope = await m.resolveScope(ada, { conversationId: chat.id });
    const note = await m.createNote(ada, scope, "remember to call");
    expect((await m.listNotes(ada, scope)).map((n) => n.body)).toEqual(["remember to call"]);
    expect(await m.listNotes(bayo, scope)).toEqual([]);

    expect((await failure(m.updateNote(bayo, note.id, "mine now"))).status).toBe(404);
    expect((await failure(m.deleteNote(bayo, note.id))).status).toBe(404);
    expect((await failure(m.resolveScope(stranger, { conversationId: chat.id }))).status).toBe(404);
    expect((await failure(m.resolveScope(ada, {}))).status).toBe(400);

    expect((await m.updateNote(ada, note.id, "remember to text")).body).toBe("remember to text");
    await m.deleteNote(ada, note.id);
    expect(await m.listNotes(ada, scope)).toEqual([]);
  });

  it("lets people who took part in a room keep notes, and nobody else", async () => {
    const host = await person("host");
    const guest = await person("guest");
    const outsider = await person("outsider");
    const removed = await person("removed");
    const room = await m.db.room.create({
      data: {
        slug: "test-room-notes",
        livekitRoom: "room_test_notes",
        host: { connect: { id: host.id } },
        title: "Notes room",
        language: "ENGLISH",
        visibility: "PUBLIC",
      },
    });
    await m.db.roomMember.create({ data: { roomId: room.id, userId: guest.id, state: "LEFT" } });
    await m.db.roomMember.create({
      data: { roomId: room.id, userId: removed.id, state: "REMOVED" },
    });
    expect(await m.resolveScope(host, { roomSlug: room.slug })).toEqual({ roomId: room.id });
    expect(await m.resolveScope(guest, { roomSlug: room.slug })).toEqual({ roomId: room.id });
    expect((await failure(m.resolveScope(outsider, { roomSlug: room.slug }))).status).toBe(403);
    expect((await failure(m.resolveScope(removed, { roomSlug: room.slug }))).status).toBe(403);
    expect((await failure(m.resolveScope(host, { roomSlug: "no-such-room" }))).status).toBe(404);
  });
});
