// Applies the committed migrations to the production `public` schema with `prisma migrate deploy`.
// Run it before (or right after) every push that adds a migration, or production reads columns that do not exist.
// Reads DIRECT_URL from .env (or PRODUCTION_DIRECT_URL when set) and forces schema=public. Usage: npm run db:migrate:prod
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadDotEnv } from "./assert-safe-db.mjs";

const root = process.cwd();
const env = { ...loadDotEnv(path.join(root, ".env")), ...process.env };
const raw = env.PRODUCTION_DIRECT_URL || env.DIRECT_URL;
if (!raw) {
  console.error("migrate-production: set PRODUCTION_DIRECT_URL or DIRECT_URL in .env.");
  process.exit(1);
}
const url = new URL(raw);
url.searchParams.set("schema", "public");
url.searchParams.delete("pgbouncer");
url.searchParams.delete("connection_limit");

console.error(`migrate-production: applying migrations to ${url.hostname}, schema public`);
const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  cwd: path.join(root, "packages", "db"),
  env: {
    ...env,
    DIRECT_URL: url.toString(),
    DATABASE_URL: url.toString(),
    DATABASE_SCHEMA: "public",
  },
});
process.exit(r.status ?? 1);
