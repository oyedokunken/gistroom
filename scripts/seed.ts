// Seeds the database. Two modes:
//   npm run db:seed            reference data and a demo world, dev and test schemas only (guarded by assert-safe-db)
//   npm run db:seed:reference  reference data only (the topics). Idempotent upserts, safe on production.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../packages/db/src/index";
import { seedDemo } from "../packages/db/src/seed/demo";
import { seedReference } from "../packages/db/src/seed/reference";
import { hashPassword } from "../apps/web/src/server/auth/password";

// A plain .env reader, so the script works without extra packages. Real environment values win.
const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m?.[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

const referenceOnly = process.argv.includes("--reference");
const schema = process.env.DATABASE_SCHEMA ?? "";
const db = getDb();

const topics = await seedReference(db);
process.stdout.write(`seed: ${topics.topics} topics ready in schema ${schema}\n`);

if (!referenceOnly) {
  if (schema !== "gistroom_dev" && schema !== "gistroom_test") {
    process.stderr.write("seed: the demo world only goes into gistroom_dev or gistroom_test.\n");
    process.exit(1);
  }
  const summary = await seedDemo(db, await hashPassword("demo-password-123"));
  process.stdout.write(
    `seed: demo world ready (${summary.users} people, ${summary.friendships} friendships, ${summary.messages} new messages, ${summary.rooms} new rooms)\n` +
      "seed: demo accounts are demo.<name>@example.com, for example demo.ada@example.com.\n",
  );
}
await db.$disconnect();
