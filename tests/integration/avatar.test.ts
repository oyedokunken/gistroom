import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareTestEnv, resetTestDb } from "../helpers/db";
import { requireTestDb } from "../helpers/require-test-db";

prepareTestEnv();

const SUPABASE = "https://storage.test";
if (requireTestDb()) {
  process.env.SUPABASE_URL = SUPABASE;
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_MEDIA_BUCKET = "media";
  process.env.SUPABASE_PUBLIC_BUCKET = "avatars";
}

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1,
]);
const TEXT = new TextEncoder().encode("not an image at all, just words in a file");

async function load() {
  const [avatar, db] = await Promise.all([
    import("../../apps/web/src/server/people/avatar"),
    import("@gistroom/db"),
  ]);
  return { ...avatar, db: db.getDb() };
}

describe.skipIf(!requireTestDb())("profile photo upload and replacement", () => {
  let m: Awaited<ReturnType<typeof load>>;
  let stored: Map<string, Uint8Array>;
  let deleted: string[];

  async function makeUser(key: string) {
    return m.db.user.create({
      data: {
        email: `test_avatar_${key}@example.com`,
        emailVerifiedAt: new Date(),
        name: `Test ${key}`,
        username: `test_avatar_${key}`,
        onboardedAt: new Date(),
      },
    });
  }

  /** Sign a slot and pretend the browser put these bytes there. */
  async function upload(user: { id: string }, bytes: Uint8Array) {
    const me = await m.db.user.findUniqueOrThrow({ where: { id: user.id } });
    const slot = await m.signAvatarUpload(me, {
      name: "avatar.jpg",
      mime: "image/jpeg",
      size: bytes.length,
    });
    const asset = await m.db.fileAsset.findUniqueOrThrow({ where: { id: slot.assetId } });
    stored.set(asset.path, bytes);
    return asset;
  }

  const fresh = (id: string) => m.db.user.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    m = await load();
  });

  beforeEach(async () => {
    await resetTestDb();
    stored = new Map();
    deleted = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const sign = /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/.exec(url);
        if (sign && init?.method === "POST") {
          return Response.json({ signedURL: `/object/sign/${sign[1]}/${sign[2]}?token=tok` });
        }
        const up = /\/storage\/v1\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(url);
        if (up) return Response.json({ url: `/object/upload/sign/${up[1]}/${up[2]}?token=t` });
        const read = /\/storage\/v1\/object\/sign\/avatars\/(.+?)\?token/.exec(url);
        if (read) {
          const bytes = stored.get(decodeURIComponent(read[1] as string));
          if (!bytes) return new Response("{}", { status: 404 });
          return new Response(bytes, {
            status: 206,
            headers: { "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` },
          });
        }
        if (init?.method === "DELETE" && url.endsWith("/storage/v1/object/avatars")) {
          const { prefixes } = JSON.parse(init.body as string) as { prefixes: string[] };
          for (const p of prefixes) {
            deleted.push(p);
            stored.delete(p);
          }
          return Response.json({});
        }
        return new Response("{}", { status: 404 });
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await resetTestDb();
  });

  it("makes the uploaded file the profile photo and survives a reload", async () => {
    const alice = await makeUser("a1");
    const asset = await upload(alice, JPEG);
    const res = await m.commitAvatar(await fresh(alice.id), asset.id);
    expect(res.path).toBe(asset.path);
    expect(res.avatarUrl).toBe(`${SUPABASE}/storage/v1/object/public/avatars/${asset.path}`);
    expect((await fresh(alice.id)).avatarPath).toBe(asset.path);
  });

  it("treats a repeated commit of the same upload as a success", async () => {
    const alice = await makeUser("a2");
    const asset = await upload(alice, JPEG);
    await m.commitAvatar(await fresh(alice.id), asset.id);
    const again = await m.commitAvatar(await fresh(alice.id), asset.id);
    expect(again.path).toBe(asset.path);
    expect(deleted).toEqual([]);
  });

  it("keeps the old file until the new one is committed, then removes it", async () => {
    const alice = await makeUser("a3");
    const first = await upload(alice, JPEG);
    await m.commitAvatar(await fresh(alice.id), first.id);
    const second = await upload(alice, JPEG);
    expect(deleted).toEqual([]);
    await m.commitAvatar(await fresh(alice.id), second.id);
    expect(deleted).toEqual([first.path]);
    expect((await fresh(alice.id)).avatarPath).toBe(second.path);
  });

  it("rejects a stale commit of an upload that was replaced", async () => {
    const alice = await makeUser("a4");
    const first = await upload(alice, JPEG);
    await m.commitAvatar(await fresh(alice.id), first.id);
    const second = await upload(alice, JPEG);
    await m.commitAvatar(await fresh(alice.id), second.id);
    await expect(m.commitAvatar(await fresh(alice.id), first.id)).rejects.toMatchObject({
      status: 404,
    });
    expect((await fresh(alice.id)).avatarPath).toBe(second.path);
  });

  it("refuses an upload that belongs to someone else", async () => {
    const alice = await makeUser("a5");
    const bob = await makeUser("b5");
    const asset = await upload(alice, JPEG);
    await expect(m.commitAvatar(await fresh(bob.id), asset.id)).rejects.toMatchObject({
      status: 404,
    });
    expect((await fresh(bob.id)).avatarPath).toBeNull();
  });

  it("keeps the existing photo when the new file is not a real image", async () => {
    const alice = await makeUser("a6");
    const good = await upload(alice, JPEG);
    await m.commitAvatar(await fresh(alice.id), good.id);
    const bad = await upload(alice, TEXT);
    await expect(m.commitAvatar(await fresh(alice.id), bad.id)).rejects.toBeTruthy();
    expect((await fresh(alice.id)).avatarPath).toBe(good.path);
    expect(stored.has(good.path)).toBe(true);
  });

  it("keeps the existing photo when the file never arrived", async () => {
    const alice = await makeUser("a7");
    const good = await upload(alice, JPEG);
    await m.commitAvatar(await fresh(alice.id), good.id);
    const me = await fresh(alice.id);
    const slot = await m.signAvatarUpload(me, {
      name: "avatar.jpg",
      mime: "image/jpeg",
      size: 100,
    });
    await expect(m.commitAvatar(me, slot.assetId)).rejects.toMatchObject({ status: 404 });
    expect((await fresh(alice.id)).avatarPath).toBe(good.path);
  });

  it("removes the photo and its file", async () => {
    const alice = await makeUser("a8");
    const asset = await upload(alice, JPEG);
    await m.commitAvatar(await fresh(alice.id), asset.id);
    await m.removeAvatar(await fresh(alice.id));
    expect((await fresh(alice.id)).avatarPath).toBeNull();
    expect(deleted).toContain(asset.path);
  });
});
