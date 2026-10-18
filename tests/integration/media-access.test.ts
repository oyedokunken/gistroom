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
}

async function load() {
  const [media, storage, db] = await Promise.all([
    import("../../apps/web/src/server/chat/media"),
    import("../../apps/web/src/server/storage"),
    import("@gistroom/db"),
  ]);
  return { ...media, resetGuard: storage.resetMediaBucketCheck, db: db.getDb() };
}

describe.skipIf(!requireTestDb())("who may open chat media", () => {
  let m: Awaited<ReturnType<typeof load>>;
  let signRequests: { path: string; expiresIn: number }[];
  let mediaBucketPublic = false;
  let attachmentId: string;
  let thumbOnlyId: string;
  let deletedId: string;
  const people = {} as Record<"alice" | "bob" | "carol", Awaited<ReturnType<typeof makeUser>>>;

  async function makeUser(key: string) {
    return m.db.user.create({
      data: {
        email: `test_media_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_media_${key}`,
        onboardedAt: new Date(),
      },
    });
  }

  beforeAll(async () => {
    m = await load();
  });

  beforeEach(async () => {
    await resetTestDb();
    m.resetGuard();
    mediaBucketPublic = false;
    signRequests = [];
    // The storage service is replaced by a fake. Signing returns a tokened path, a bucket lookup says if it is public.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const bucket = /\/storage\/v1\/bucket\/([^/?]+)$/.exec(url);
        if (bucket) return Response.json({ id: bucket[1], public: mediaBucketPublic });
        const sign = /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(url);
        if (sign) {
          const body = JSON.parse((init?.body as string) ?? "{}") as { expiresIn: number };
          signRequests.push({
            path: decodeURIComponent(sign[2] as string),
            expiresIn: body.expiresIn,
          });
          return Response.json({ signedURL: `/object/sign/${sign[1]}/${sign[2]}?token=tok` });
        }
        return new Response("{}", { status: 404 });
      }),
    );

    people.alice = await makeUser("alice");
    people.bob = await makeUser("bob");
    people.carol = await makeUser("carol");
    const conversation = await m.db.conversation.create({
      data: {
        dmKey: `${people.alice.id}:${people.bob.id}`,
        members: { create: [{ userId: people.alice.id }, { userId: people.bob.id }] },
      },
    });
    const withAttachment = async (
      clientId: string,
      over: { deleted?: boolean; thumb?: boolean },
    ) => {
      const message = await m.db.message.create({
        data: {
          conversationId: conversation.id,
          senderId: people.alice.id,
          clientId,
          type: "IMAGE",
          deletedForEveryoneAt: over.deleted ? new Date() : null,
          attachments: {
            create: {
              storagePath: `dm/${conversation.id}/${people.alice.id}/${clientId}.jpg`,
              thumbPath: over.thumb
                ? `dm/${conversation.id}/${people.alice.id}/${clientId}-t.jpg`
                : null,
              mime: "image/jpeg",
              sizeBytes: 1000,
            },
          },
        },
        include: { attachments: true },
      });
      return (message.attachments[0] as { id: string }).id;
    };
    attachmentId = await withAttachment("a1", { thumb: true });
    thumbOnlyId = await withAttachment("a2", {});
    deletedId = await withAttachment("a3", { deleted: true });
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await resetTestDb();
  });

  it("gives both people in the chat a short lived signed link, never a public one", async () => {
    for (const person of [people.alice, people.bob]) {
      const url = await m.attachmentLink(person, attachmentId, false);
      expect(url.startsWith(`${SUPABASE}/storage/v1/object/sign/media/dm/`)).toBe(true);
      expect(url).toContain("token=");
      expect(url).not.toContain("/object/public/");
    }
    expect(signRequests.every((r) => r.expiresIn === 300)).toBe(true);
  });

  it("serves the thumbnail only when asked for it and only when there is one", async () => {
    const thumb = await m.attachmentLink(people.bob, attachmentId, true);
    expect(decodeURIComponent(thumb)).toContain("a1-t.jpg");
    const noThumb = await m.attachmentLink(people.bob, thumbOnlyId, true);
    expect(decodeURIComponent(noThumb)).toContain("a2.jpg");
    expect(decodeURIComponent(noThumb)).not.toContain("-t.jpg");
  });

  it("refuses a person who is not in the chat, without asking storage to sign anything", async () => {
    await expect(m.attachmentLink(people.carol, attachmentId, false)).rejects.toMatchObject({
      status: 404,
    });
    expect(signRequests).toHaveLength(0);
  });

  it("refuses an id that does not exist and a message deleted for everyone", async () => {
    await expect(m.attachmentLink(people.alice, "no_such_id", false)).rejects.toMatchObject({
      status: 404,
    });
    await expect(m.attachmentLink(people.alice, deletedId, false)).rejects.toMatchObject({
      status: 404,
    });
    expect(signRequests).toHaveLength(0);
  });

  it("only signs paths that are stored in the database, never a path the caller supplies", async () => {
    await m.attachmentLink(people.alice, attachmentId, false);
    expect(signRequests.map((r) => r.path)).toEqual([
      expect.stringMatching(/^dm\/[^/]+\/[^/]+\/a1\.jpg$/),
    ]);
  });

  it("refuses to sign anything while the media bucket is public", async () => {
    mediaBucketPublic = true;
    await expect(m.attachmentLink(people.alice, attachmentId, false)).rejects.toMatchObject({
      status: 503,
    });
    expect(signRequests).toHaveLength(0);
  });

  it("refuses to hand out an upload URL while the media bucket is public", async () => {
    mediaBucketPublic = true;
    await expect(
      m.signChatUpload(people.alice, {
        conversationId: "irrelevant",
        name: "a.jpg",
        mime: "image/jpeg",
        size: 1000,
        role: "main",
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
