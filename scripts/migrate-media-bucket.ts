// Moves chat media from the public bucket into a private one and rewrites the stored references (D39, R15).
//
//   npm run storage:migrate-media -- --from avatars --to media                  report only (the default)
//   npm run storage:migrate-media -- --from avatars --to media --apply          copy objects, point rows at the new bucket
//   npm run storage:migrate-media -- --from avatars --to media --apply --delete-source   also remove the public copies
//
// --dry-run is accepted and is the same as leaving out --apply. The script is safe to run again at any point.
// It reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and the database settings from .env, like every other script.
// The target bucket must already exist and be private (npm run storage:setup creates it). Chat media keys are stored
// in MessageAttachment and FileAsset as object keys, never URLs, so only FileAsset.bucket needs to change.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../packages/db/src/index";
import {
  CHAT_PREFIX,
  MigrationRefused,
  migrateMediaBucket,
  type BucketInfo,
  type MigrationDb,
  type MigrationStorage,
} from "./lib/media-bucket-migration";

const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m?.[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const from = argValue("--from");
const to = argValue("--to");
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const deleteSource = process.argv.includes("--delete-source");
const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!from || !to || !url || !key) {
  process.stderr.write(
    "Usage: storage:migrate-media -- --from <bucket> --to <private bucket> [--apply] [--delete-source]\n" +
      "Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.\n",
  );
  process.exit(1);
}

const auth = { Authorization: `Bearer ${key}`, apikey: key };
const json = { ...auth, "Content-Type": "application/json" };
const encode = (p: string) => p.split("/").map(encodeURIComponent).join("/");

const storage: MigrationStorage = {
  async bucket(id) {
    const res = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(id)}`, {
      headers: auth,
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`Bucket lookup failed: ${res.status}`);
    const body = (await res.json()) as BucketInfo;
    return { id: body.id, public: Boolean(body.public) };
  },
  async exists(bucket, p) {
    const res = await fetch(`${url}/storage/v1/object/info/${bucket}/${encode(p)}`, {
      headers: auth,
    });
    if (res.ok) return true;
    if (res.status === 404 || res.status === 400) return false;
    throw new Error(`Object lookup failed: ${res.status}`);
  },
  async copy(source, target, p) {
    const res = await fetch(`${url}/storage/v1/object/copy`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        bucketId: source,
        sourceKey: p,
        destinationBucket: target,
        destinationKey: p,
      }),
    });
    // 409 means the object is already there, which is what a re-run wants.
    if (!res.ok && res.status !== 409) throw new Error(`Copy of ${p} failed: ${res.status}`);
  },
  async remove(bucket, paths) {
    const res = await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: json,
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!res.ok) throw new Error(`Remove failed: ${res.status}`);
  },
};

const prisma = getDb();
const db: MigrationDb = {
  async attachmentPaths() {
    const rows = await prisma.messageAttachment.findMany({
      select: { storagePath: true, thumbPath: true },
    });
    return rows.flatMap((r) => [r.storagePath, ...(r.thumbPath ? [r.thumbPath] : [])]);
  },
  async assetPathsIn(bucket) {
    const rows = await prisma.fileAsset.findMany({
      where: { bucket, path: { startsWith: CHAT_PREFIX } },
      select: { path: true },
    });
    return rows.map((r) => r.path);
  },
  async moveAssets(paths, source, target) {
    let moved = 0;
    for (const p of paths) {
      const there = await prisma.fileAsset.findUnique({
        where: { bucket_path: { bucket: target, path: p } },
        select: { id: true },
      });
      // A row for the new bucket already exists: the old one is a stale duplicate.
      if (there) await prisma.fileAsset.deleteMany({ where: { bucket: source, path: p } });
      else {
        const r = await prisma.fileAsset.updateMany({
          where: { bucket: source, path: p },
          data: { bucket: target },
        });
        moved += r.count;
      }
    }
    return moved;
  },
};

process.stdout.write(
  `Schema ${process.env.DATABASE_SCHEMA ?? "public"}, ${apply ? "APPLYING changes" : "report only (add --apply to write)"}\n`,
);
try {
  await migrateMediaBucket(storage, db, {
    from,
    to,
    dryRun: !apply,
    deleteSource,
    log: (line) => process.stdout.write(`${line}\n`),
  });
} catch (error) {
  process.stderr.write(
    `${error instanceof MigrationRefused ? "Refused: " : "Failed: "}${(error as Error).message}\n`,
  );
  process.exit(1);
}
process.exit(0);
