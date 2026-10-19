/* global fetch */
// Checks that the buckets are set up the way R15 needs: chat media in a private bucket of its own, and only avatars
// in the public one. Read only. Exits 1 when the media bucket is public, missing, or the same as the avatar bucket.
// Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_MEDIA_BUCKET and SUPABASE_PUBLIC_BUCKET from .env.
import path from "node:path";
import { loadDotEnv } from "./assert-safe-db.mjs";

const env = { ...loadDotEnv(path.join(process.cwd(), ".env")), ...process.env };
const url = env.SUPABASE_URL?.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const media = env.SUPABASE_MEDIA_BUCKET || "media";
const avatars = env.SUPABASE_PUBLIC_BUCKET || "avatars";

if (!url || !key) {
  process.stderr.write("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.\n");
  process.exit(1);
}

async function lookup(id) {
  const res = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Bucket lookup for ${id} failed: ${res.status}`);
  return res.json();
}

let failed = false;
if (media === avatars) {
  process.stderr.write(
    `FAIL  SUPABASE_MEDIA_BUCKET and SUPABASE_PUBLIC_BUCKET are both "${media}".\n`,
  );
  failed = true;
}
const mediaBucket = await lookup(media);
if (!mediaBucket) {
  process.stderr.write(`FAIL  media bucket "${media}" does not exist (npm run storage:setup).\n`);
  failed = true;
} else if (mediaBucket.public) {
  process.stderr.write(
    `FAIL  media bucket "${media}" is public. Chat media must be private (R15).\n`,
  );
  failed = true;
} else {
  process.stdout.write(`ok    media bucket "${media}" is private.\n`);
}
const avatarBucket = await lookup(avatars);
if (!avatarBucket) {
  process.stderr.write(
    `FAIL  avatar bucket "${avatars}" does not exist (npm run storage:setup).\n`,
  );
  failed = true;
} else {
  process.stdout.write(
    `ok    avatar bucket "${avatars}" is ${avatarBucket.public ? "public, as intended" : "private (avatars will not load)"}.\n`,
  );
}
process.exit(failed ? 1 : 0);
