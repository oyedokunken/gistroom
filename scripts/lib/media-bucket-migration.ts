// Moves chat media out of a public storage bucket into a private one (decision D39, rule R15).
// The logic is here, with the database and the storage service passed in, so a test can run it against fakes.
// scripts/migrate-media-bucket.ts wires it to Prisma and Supabase Storage.

/** Chat media keys always start with this prefix. Avatars and anything else in the source bucket are left alone. */
export const CHAT_PREFIX = "dm/";

export interface BucketInfo {
  id: string;
  public: boolean;
}

export interface MigrationStorage {
  bucket(id: string): Promise<BucketInfo | null>;
  exists(bucket: string, path: string): Promise<boolean>;
  /** Copies one object between buckets. Resolves when the copy is there, including when it already was. */
  copy(from: string, to: string, path: string): Promise<void>;
  remove(bucket: string, paths: string[]): Promise<void>;
}

export interface MigrationDb {
  /** Every chat media key the messages point at (main files and thumbnails). */
  attachmentPaths(): Promise<string[]>;
  /** Keys of the chat media FileAsset rows recorded against this bucket. */
  assetPathsIn(bucket: string): Promise<string[]>;
  /** Points the FileAsset rows for these keys at a new bucket. Returns how many rows changed. */
  moveAssets(paths: string[], from: string, to: string): Promise<number>;
}

export interface MigrationOptions {
  from: string;
  to: string;
  /** Report only. Nothing is copied, rewritten or removed. */
  dryRun: boolean;
  /** Remove each source object once its copy is confirmed in the private bucket. */
  deleteSource: boolean;
  log: (line: string) => void;
}

export interface MigrationReport {
  dryRun: boolean;
  considered: number;
  alreadyThere: number;
  copied: number;
  missingInSource: number;
  rowsMoved: number;
  sourceRemoved: number;
}

export class MigrationRefused extends Error {}

const BATCH = 100;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Safe to run again at any point. Each key is copied only when the private bucket does not have it, rows are
 * rewritten only while they still name the old bucket, and source objects are removed only after the private copy
 * is confirmed. A run that stopped half way finishes the next time.
 */
export async function migrateMediaBucket(
  storage: MigrationStorage,
  db: MigrationDb,
  options: MigrationOptions,
): Promise<MigrationReport> {
  const { from, to, dryRun, deleteSource, log } = options;
  if (from === to) throw new MigrationRefused("The source and target bucket are the same.");
  const target = await storage.bucket(to);
  if (!target)
    throw new MigrationRefused(`Target bucket "${to}" does not exist. Run npm run storage:setup.`);
  if (target.public)
    throw new MigrationRefused(`Target bucket "${to}" is public. It must be private.`);
  if (!(await storage.bucket(from)))
    throw new MigrationRefused(`Source bucket "${from}" does not exist.`);

  const keys = [
    ...new Set(
      [...(await db.attachmentPaths()), ...(await db.assetPathsIn(from))].filter((p) =>
        p.startsWith(CHAT_PREFIX),
      ),
    ),
  ].sort();
  const report: MigrationReport = {
    dryRun,
    considered: keys.length,
    alreadyThere: 0,
    copied: 0,
    missingInSource: 0,
    rowsMoved: 0,
    sourceRemoved: 0,
  };
  log(`${dryRun ? "Dry run: " : ""}${keys.length} chat media keys to check, ${from} -> ${to}`);

  const confirmed: string[] = [];
  for (const path of keys) {
    if (await storage.exists(to, path)) {
      report.alreadyThere += 1;
      confirmed.push(path);
      continue;
    }
    if (!(await storage.exists(from, path))) {
      report.missingInSource += 1;
      log(`missing in both buckets, left as it is: ${path}`);
      continue;
    }
    if (dryRun) {
      report.copied += 1;
      log(`would copy ${path}`);
      continue;
    }
    await storage.copy(from, to, path);
    if (!(await storage.exists(to, path)))
      throw new Error(`Copy of ${path} did not show up in ${to}.`);
    report.copied += 1;
    confirmed.push(path);
  }

  if (!dryRun) {
    for (const batch of chunks(confirmed, BATCH)) {
      report.rowsMoved += await db.moveAssets(batch, from, to);
    }
  }

  if (deleteSource) {
    // Also covers a run that moved the rows and then stopped before removing the old objects.
    const leftovers = new Set([...confirmed, ...(await db.assetPathsIn(to))]);
    for (const batch of chunks([...leftovers].sort(), BATCH)) {
      const present: string[] = [];
      for (const path of batch) {
        if (!path.startsWith(CHAT_PREFIX)) continue;
        // Never remove a source copy unless the private copy is there.
        if ((await storage.exists(from, path)) && (await storage.exists(to, path)))
          present.push(path);
      }
      if (present.length === 0) continue;
      if (dryRun) log(`would remove ${present.length} objects from ${from}`);
      else await storage.remove(from, present);
      report.sourceRemoved += present.length;
    }
  }

  log(
    `${dryRun ? "Dry run done" : "Done"}: ${report.copied} copied, ${report.alreadyThere} already private, ` +
      `${report.missingInSource} missing, ${report.rowsMoved} rows moved, ${report.sourceRemoved} source objects removed.`,
  );
  return report;
}
