import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();

const SUPABASE = "https://storage.test";
if (requireTestDb()) {
  process.env.SUPABASE_URL = SUPABASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_MEDIA_BUCKET = "media";
  process.env.SUPABASE_PUBLIC_BUCKET = "avatars";
  process.env.REALTIME_URL = "http://nothing-listens.invalid";
}

async function load() {
  const [forward, db] = await Promise.all([
    import("../../apps/web/src/server/chat/forward"),
    import("@gistroom/db"),
  ]);
  return { ...forward, db: db.getDb() };
}

describe.skipIf(!requireTestDb())("forwarding messages", () => {
  let m: Awaited<ReturnType<typeof load>>;
  let copies: { from: string; to: string }[];
  const people = {} as Record<"ada" | "bola" | "chi" | "dayo", Awaited<ReturnType<typeof person>>>;
  let adaBola: string;
  let adaChi: string;

  async function person(key: string) {
    return m.db.user.create({
      data: {
        email: `test_fwd_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_fwd_${key}`,
        onboardedAt: new Date(),
      },
    });
  }
  async function friends(a: { id: string }, b: { id: string }) {
    const [low, high] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    await m.db.friendship.create({ data: { userLowId: low, userHighId: high } });
    const c = await m.db.conversation.create({
      data: { dmKey: `${low}:${high}`, members: { create: [{ userId: a.id }, { userId: b.id }] } },
    });
    return c.id;
  }
  async function say(
    conversationId: string,
    senderId: string,
    clientId: string,
    over: Record<string, unknown> = {},
  ) {
    return m.db.message.create({
      data: { conversationId, senderId, clientId, type: "TEXT", body: "hello there", ...over },
    });
  }
  async function media(conversationId: string, senderId: string, clientId: string, type: string) {
    const path = `dm/${conversationId}/${senderId}/${clientId}.bin`;
    const mime =
      type === "VOICE" ? "audio/webm" : type === "IMAGE" ? "image/jpeg" : "application/pdf";
    return m.db.message.create({
      data: {
        conversationId,
        senderId,
        clientId,
        type: type as never,
        meta: { fileName: "notes.pdf" },
        attachments: {
          create: {
            storagePath: path,
            thumbPath: type === "IMAGE" ? `${path}.t.jpg` : null,
            mime,
            sizeBytes: 1234,
            durationMs: type === "VOICE" ? 9000 : null,
            waveform: type === "VOICE" ? [10, 20, 30] : [],
          },
        },
      },
    });
  }
  const as = (u: { id: string }) => m.db.user.findUniqueOrThrow({ where: { id: u.id } });

  beforeAll(async () => {
    m = await load();
  });

  beforeEach(async () => {
    await resetTestDb();
    copies = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (/\/storage\/v1\/bucket\/media$/.test(url)) return Response.json({ public: false });
        if (url.endsWith("/storage/v1/object/copy")) {
          const b = JSON.parse(init?.body as string) as {
            sourceKey: string;
            destinationKey: string;
          };
          copies.push({ from: b.sourceKey, to: b.destinationKey });
          return Response.json({ Key: b.destinationKey });
        }
        return new Response("{}", { status: 404 });
      }),
    );
    people.ada = await person("ada");
    people.bola = await person("bola");
    people.chi = await person("chi");
    people.dayo = await person("dayo");
    adaBola = await friends(people.ada, people.bola);
    adaChi = await friends(people.ada, people.chi);
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await resetTestDb();
  });

  it("forwards text as a new message marked Forwarded, from the forwarder, without the original author", async () => {
    const original = await say(adaBola, people.bola.id, "orig-text-1", { body: "Match at 8" });
    const res = await m.forwardMessages(await as(people.ada), {
      batchId: "batch_text_01",
      messageIds: [original.id],
      userIds: [people.chi.id],
    });
    expect(res.outcomes[0]).toMatchObject({ sent: 1, error: null });
    const copy = await m.db.message.findFirstOrThrow({
      where: { conversationId: adaChi },
      orderBy: { createdAt: "desc" },
    });
    expect(copy.id).not.toBe(original.id);
    expect(copy.senderId).toBe(people.ada.id);
    expect(copy.body).toBe("Match at 8");
    expect(copy.clientId).not.toBe(original.clientId);
    expect(copy.meta).toMatchObject({ forwarded: true, forwardedFrom: "TEXT" });
    expect(JSON.stringify(copy.meta)).not.toContain(people.bola.id);
  });

  it("copies an image, a document and a voice note to paths in the destination chat", async () => {
    const image = await media(adaBola, people.bola.id, "orig-img-0001", "IMAGE");
    const file = await media(adaBola, people.bola.id, "orig-file-001", "FILE");
    const voice = await media(adaBola, people.bola.id, "orig-voice-01", "VOICE");
    const res = await m.forwardMessages(await as(people.ada), {
      batchId: "batch_media_01",
      messageIds: [image.id, file.id, voice.id],
      userIds: [people.chi.id],
    });
    expect(res.outcomes[0]?.sent).toBe(3);
    const rows = await m.db.message.findMany({
      where: { conversationId: adaChi },
      include: { attachments: true },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const att = row.attachments[0]!;
      expect(att.storagePath.startsWith(`dm/${adaChi}/${people.ada.id}/`)).toBe(true);
      expect(att.storagePath).not.toContain(adaBola);
      expect(row.meta).toMatchObject({ forwarded: true });
    }
    expect(copies.some((c) => c.from.endsWith(".bin") && c.to.includes(adaChi))).toBe(true);
    expect(copies.some((c) => c.from.endsWith(".t.jpg"))).toBe(true);
    const voiceCopy = rows.find((r) => r.type === "VOICE")!.attachments[0]!;
    expect(voiceCopy).toMatchObject({ durationMs: 9000, mime: "audio/webm" });
    expect(voiceCopy.waveform).toEqual([10, 20, 30]);
    expect(rows.find((r) => r.type === "FILE")!.meta).toMatchObject({ fileName: "notes.pdf" });
    expect(await m.db.fileAsset.count({ where: { ownerId: people.ada.id } })).toBe(4);
  });

  it("does not create a second copy when the same request is retried", async () => {
    const original = await say(adaBola, people.bola.id, "orig-text-2");
    const img = await media(adaBola, people.bola.id, "orig-img-0002", "IMAGE");
    const input = {
      batchId: "batch_retry_01",
      messageIds: [original.id, img.id],
      userIds: [people.chi.id],
    };
    await m.forwardMessages(await as(people.ada), input);
    const before = copies.length;
    const again = await m.forwardMessages(await as(people.ada), input);
    expect(again.outcomes[0]?.sent).toBe(2);
    expect(await m.db.message.count({ where: { conversationId: adaChi } })).toBe(2);
    expect(copies.length).toBe(before);
  });

  it("forwards a forwarded message without a chain of senders", async () => {
    const original = await say(adaBola, people.bola.id, "orig-text-3");
    await m.forwardMessages(await as(people.ada), {
      batchId: "batch_chain_01",
      messageIds: [original.id],
      userIds: [people.chi.id],
    });
    const first = await m.db.message.findFirstOrThrow({ where: { conversationId: adaChi } });
    await m.forwardMessages(await as(people.ada), {
      batchId: "batch_chain_02",
      messageIds: [first.id],
      userIds: [people.bola.id],
    });
    const second = await m.db.message.findFirstOrThrow({
      where: { conversationId: adaBola, meta: { path: ["forwarded"], equals: true } },
    });
    expect(second.meta).toEqual({ forwarded: true, forwardedFrom: "TEXT" });
  });

  it("leaves out deleted, hidden and system messages, and refuses when none are left", async () => {
    const good = await say(adaBola, people.bola.id, "orig-text-4");
    const deleted = await say(adaBola, people.bola.id, "orig-text-5", {
      deletedForEveryoneAt: new Date(),
    });
    const hidden = await say(adaBola, people.bola.id, "orig-text-6");
    await m.db.messageHidden.create({ data: { userId: people.ada.id, messageId: hidden.id } });
    const system = await say(adaBola, people.bola.id, "orig-sys-001", { type: "SYSTEM" });
    const res = await m.forwardMessages(await as(people.ada), {
      batchId: "batch_skip_001",
      messageIds: [good.id, deleted.id, hidden.id, system.id],
      userIds: [people.chi.id],
    });
    expect(res.skipped).toBe(3);
    expect(res.outcomes[0]?.sent).toBe(1);
    await expect(
      m.forwardMessages(await as(people.ada), {
        batchId: "batch_skip_002",
        messageIds: [deleted.id],
        userIds: [people.chi.id],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuses a message from a chat the forwarder is not in, like a missing one", async () => {
    const chiDayo = await friends(people.chi, people.dayo);
    const secret = await say(chiDayo, people.chi.id, "orig-secret-1");
    await expect(
      m.forwardMessages(await as(people.ada), {
        batchId: "batch_auth_001",
        messageIds: [secret.id],
        userIds: [people.bola.id],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await m.db.message.count({ where: { conversationId: adaBola } })).toBe(0);
  });

  it("does not send to someone who is not a friend or who blocked the forwarder", async () => {
    const original = await say(adaBola, people.bola.id, "orig-text-7");
    await m.db.block.create({ data: { blockerId: people.chi.id, blockedId: people.ada.id } });
    const res = await m.forwardMessages(await as(people.ada), {
      batchId: "batch_block_01",
      messageIds: [original.id],
      userIds: [people.chi.id, people.dayo.id],
    });
    expect(res.outcomes.map((o) => [o.sent, o.error !== null])).toEqual([
      [0, true],
      [0, true],
    ]);
    expect(await m.db.message.count({ where: { conversationId: adaChi } })).toBe(0);
  });

  it("reports one failure without stopping the others", async () => {
    const original = await say(adaBola, people.bola.id, "orig-text-8");
    const res = await m.forwardMessages(await as(people.ada), {
      batchId: "batch_mixed_01",
      messageIds: [original.id],
      userIds: [people.dayo.id, people.chi.id],
    });
    expect(res.outcomes[0]).toMatchObject({ userId: people.dayo.id, sent: 0 });
    expect(res.outcomes[0]?.error).toBeTruthy();
    expect(res.outcomes[1]).toMatchObject({ userId: people.chi.id, sent: 1, error: null });
  });
});
