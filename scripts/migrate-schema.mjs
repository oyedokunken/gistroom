// Applies the committed migrations to a dev or test schema. Prisma migrate cannot do this on our hosted database,
// because citext and pg_trgm live in the public schema and Prisma narrows the search path to one schema.
// Production keeps using `prisma migrate deploy`. Usage: node scripts/migrate-schema.mjs (reads .env and DATABASE_SCHEMA)
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { assertSafe, loadDotEnv } from "./assert-safe-db.mjs";

const root = process.cwd();
const env = { ...loadDotEnv(path.join(root, ".env")), ...process.env };
const problem = assertSafe(env);
if (problem) {
  console.error(`migrate-schema: ${problem}`);
  process.exit(1);
}
const schema = env.DATABASE_SCHEMA;
const url = new URL(env.DIRECT_URL || env.DATABASE_URL);
url.searchParams.delete("schema");
url.searchParams.delete("pgbouncer");
url.searchParams.set("options", `-c search_path=${schema},public`);

const dir = path.join(root, "packages", "db", "prisma", "migrations");
const names = readdirSync(dir)
  .filter((n) => existsSync(path.join(dir, n, "migration.sql")))
  .sort();

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
await client.query(
  `CREATE TABLE IF NOT EXISTS ${schema}."_gistroom_migrations" (name text PRIMARY KEY, appliedAt timestamptz NOT NULL DEFAULT now())`,
);
const done = new Set(
  (await client.query(`SELECT name FROM ${schema}."_gistroom_migrations"`)).rows.map((r) => r.name),
);
let applied = 0;
for (const name of names) {
  if (done.has(name)) continue;
  await client.query("BEGIN");
  try {
    await client.query(readFileSync(path.join(dir, name, "migration.sql"), "utf8"));
    await client.query(`INSERT INTO ${schema}."_gistroom_migrations" (name) VALUES ($1)`, [name]);
    await client.query("COMMIT");
    applied += 1;
    console.log(`migrate-schema: applied ${name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`migrate-schema: ${name} failed: ${error.message}`);
    process.exit(1);
  }
}
console.log(`migrate-schema: ${schema} is up to date (${applied} applied, ${names.length} total)`);
await client.end();
