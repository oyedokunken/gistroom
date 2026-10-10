/* global fetch */
// Creates the two Supabase Storage buckets Gistroom needs: a private one for chat media and a public one for avatars.
// Safe to run more than once. Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env at the repo root.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  process.stderr.write("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.\n");
  process.exit(1);
}

const buckets = [
  { id: process.env.SUPABASE_MEDIA_BUCKET || "media", public: false, limit: 50 * 1024 * 1024 },
  { id: process.env.SUPABASE_PUBLIC_BUCKET || "avatars", public: true, limit: 5 * 1024 * 1024 },
];

for (const b of buckets) {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: b.id, name: b.id, public: b.public, file_size_limit: b.limit }),
  });
  const body = await res.text();
  if (res.ok)
    process.stdout.write(`Created bucket ${b.id} (${b.public ? "public" : "private"}).\n`);
  else if (/already exists|Duplicate/i.test(body))
    process.stdout.write(`Bucket ${b.id} already exists.\n`);
  else {
    process.stderr.write(`Could not create bucket ${b.id}: ${res.status} ${body.slice(0, 200)}\n`);
    process.exitCode = 1;
  }
}
