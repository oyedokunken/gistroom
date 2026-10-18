import { beforeEach, describe, expect, it } from "vitest";
import {
  MigrationRefused,
  migrateMediaBucket,
  type MigrationDb,
  type MigrationStorage,
} from "../../scripts/lib/media-bucket-migration";

/** In-memory stand-ins for the storage service and the FileAsset and MessageAttachment tables. */
function world() {
  const buckets = new Map<string, { public: boolean; objects: Set<string> }>([
    ["avatars", { public: true, objects: new Set() }],
    ["media", { public: false, objects: new Set() }],
  ]);
  const assets = new Map<string, string>(); // path -> bucket
  const attachments: { storagePath: string; thumbPath: string | null }[] = [];
  const calls = { copy: 0, remove: 0, moveAssets: 0 };

  const storage: MigrationStorage = {
    async bucket(id) {
      const b = buckets.get(id);
      return b ? { id, public: b.public } : null;
    },
    async exists(bucket, path) {
      return buckets.get(bucket)?.objects.has(path) ?? false;
    },
    async copy(from, to, path) {
      calls.copy += 1;
      if (buckets.get(from)?.objects.has(path)) buckets.get(to)?.objects.add(path);
    },
    async remove(bucket, paths) {
      calls.remove += 1;
      for (const p of paths) buckets.get(bucket)?.objects.delete(p);
    },
  };
  const db: MigrationDb = {
    async attachmentPaths() {
      return attachments.flatMap((a) => [a.storagePath, ...(a.thumbPath ? [a.thumbPath] : [])]);
    },
    async assetPathsIn(bucket) {
      return [...assets].filter(([, b]) => b === bucket).map(([p]) => p);
    },
    async moveAssets(paths, from, to) {
      calls.moveAssets += 1;
      let moved = 0;
      for (const p of paths) {
        if (assets.get(p) === from) {
          assets.set(p, to);
          moved += 1;
        }
      }
      return moved;
    },
  };

  function legacy(path: string, opts: { thumb?: string } = {}) {
    buckets.get("avatars")?.objects.add(path);
    assets.set(path, "avatars");
    if (opts.thumb) {
      buckets.get("avatars")?.objects.add(opts.thumb);
      assets.set(opts.thumb, "avatars");
    }
    attachments.push({ storagePath: path, thumbPath: opts.thumb ?? null });
  }
  return { buckets, assets, attachments, calls, storage, db, legacy };
}

const options = (over: Partial<Parameters<typeof migrateMediaBucket>[2]> = {}) => ({
  from: "avatars",
  to: "media",
  dryRun: false,
  deleteSource: false,
  log: () => undefined,
  ...over,
});

describe("moving chat media into the private bucket", () => {
  let w: ReturnType<typeof world>;
  beforeEach(() => {
    w = world();
    w.legacy("dm/c1/u1/a.jpg", { thumb: "dm/c1/u1/a-thumb.jpg" });
    w.legacy("dm/c1/u2/b.pdf");
    // An avatar sits in the same public bucket and must stay put.
    w.buckets.get("avatars")?.objects.add("u1/avatar.jpg");
    w.assets.set("u1/avatar.jpg", "avatars");
  });

  it("copies every chat key, points the rows at the private bucket and leaves avatars alone", async () => {
    const report = await migrateMediaBucket(w.storage, w.db, options());
    expect(report).toMatchObject({ considered: 3, copied: 3, rowsMoved: 3, sourceRemoved: 0 });
    expect([...(w.buckets.get("media")?.objects ?? [])].sort()).toEqual([
      "dm/c1/u1/a-thumb.jpg",
      "dm/c1/u1/a.jpg",
      "dm/c1/u2/b.pdf",
    ]);
    expect(w.assets.get("dm/c1/u1/a.jpg")).toBe("media");
    expect(w.assets.get("u1/avatar.jpg")).toBe("avatars");
    // The public copies stay until --delete-source is used.
    expect(w.buckets.get("avatars")?.objects.has("dm/c1/u1/a.jpg")).toBe(true);
  });

  it("changes nothing in a dry run", async () => {
    const report = await migrateMediaBucket(w.storage, w.db, options({ dryRun: true }));
    expect(report).toMatchObject({ dryRun: true, considered: 3, copied: 3, rowsMoved: 0 });
    expect(w.calls).toEqual({ copy: 0, remove: 0, moveAssets: 0 });
    expect(w.buckets.get("media")?.objects.size).toBe(0);
    expect(w.assets.get("dm/c1/u2/b.pdf")).toBe("avatars");
  });

  it("is safe to run twice", async () => {
    await migrateMediaBucket(w.storage, w.db, options());
    const copiesAfterFirst = w.calls.copy;
    const again = await migrateMediaBucket(w.storage, w.db, options());
    expect(again).toMatchObject({ copied: 0, alreadyThere: 3, rowsMoved: 0 });
    expect(w.calls.copy).toBe(copiesAfterFirst);
  });

  it("finishes a run that stopped after the copy but before the rows moved", async () => {
    w.buckets.get("media")?.objects.add("dm/c1/u2/b.pdf");
    const report = await migrateMediaBucket(w.storage, w.db, options());
    expect(report).toMatchObject({ alreadyThere: 1, copied: 2, rowsMoved: 3 });
    expect(w.assets.get("dm/c1/u2/b.pdf")).toBe("media");
  });

  it("removes public copies only with --delete-source, and only after the private copy is confirmed", async () => {
    const report = await migrateMediaBucket(w.storage, w.db, options({ deleteSource: true }));
    expect(report.sourceRemoved).toBe(3);
    expect(w.buckets.get("avatars")?.objects.has("dm/c1/u1/a.jpg")).toBe(false);
    expect(w.buckets.get("media")?.objects.has("dm/c1/u1/a.jpg")).toBe(true);
    // Avatars are untouched by the clean up.
    expect(w.buckets.get("avatars")?.objects.has("u1/avatar.jpg")).toBe(true);
  });

  it("cleans up public copies left behind by an earlier run that moved the rows", async () => {
    await migrateMediaBucket(w.storage, w.db, options());
    const report = await migrateMediaBucket(w.storage, w.db, options({ deleteSource: true }));
    expect(report.sourceRemoved).toBe(3);
    expect(w.buckets.get("avatars")?.objects.has("dm/c1/u2/b.pdf")).toBe(false);
  });

  it("never removes a public copy when the private one is missing", async () => {
    w.storage.copy = async () => undefined; // a copy that silently does nothing
    await expect(
      migrateMediaBucket(w.storage, w.db, options({ deleteSource: true })),
    ).rejects.toThrow(/did not show up/);
    expect(w.calls.remove).toBe(0);
    expect(w.buckets.get("avatars")?.objects.has("dm/c1/u1/a.jpg")).toBe(true);
  });

  it("reports a key that is in neither bucket and moves on", async () => {
    w.attachments.push({ storagePath: "dm/c9/u9/gone.jpg", thumbPath: null });
    const report = await migrateMediaBucket(w.storage, w.db, options());
    expect(report.missingInSource).toBe(1);
    expect(report.copied).toBe(3);
  });

  it("refuses a public target, a missing bucket, and a source equal to the target", async () => {
    w.buckets.get("media")!.public = true;
    await expect(migrateMediaBucket(w.storage, w.db, options())).rejects.toBeInstanceOf(
      MigrationRefused,
    );
    w.buckets.get("media")!.public = false;
    await expect(
      migrateMediaBucket(w.storage, w.db, options({ to: "nowhere" })),
    ).rejects.toBeInstanceOf(MigrationRefused);
    await expect(
      migrateMediaBucket(w.storage, w.db, options({ from: "media", to: "media" })),
    ).rejects.toBeInstanceOf(MigrationRefused);
    await expect(
      migrateMediaBucket(w.storage, w.db, options({ from: "ghost" })),
    ).rejects.toBeInstanceOf(MigrationRefused);
    expect(w.calls.copy).toBe(0);
  });
});
