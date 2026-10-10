// Wraps destructive Prisma commands. Refuses unless the schema is a dev or test schema
// and the host is not the production host (Section 5.3).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SAFE_SCHEMAS = new Set(["gistroom_dev", "gistroom_test"]);

export function loadDotEnv(file) {
  const env = {};
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
  }
  return env;
}

export function assertSafe(env) {
  const schema = env.DATABASE_SCHEMA;
  const url = env.DIRECT_URL || env.DATABASE_URL || "";
  if (!schema || !SAFE_SCHEMAS.has(schema)) {
    return `DATABASE_SCHEMA must be gistroom_dev or gistroom_test, got "${schema ?? ""}".`;
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return "DATABASE_URL or DIRECT_URL is missing or not a valid URL.";
  }
  if (env.PRODUCTION_DB_HOST && host === env.PRODUCTION_DB_HOST) {
    return `Host ${host} is the production database host. Refusing.`;
  }
  return null;
}

if (process.argv[1]?.endsWith("assert-safe-db.mjs")) {
  const env = { ...loadDotEnv(path.join(process.cwd(), ".env")), ...process.env };
  const problem = assertSafe(env);
  if (problem) {
    console.error(`assert-safe-db: ${problem}`);
    process.exit(1);
  }
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) process.exit(0);
  const r = spawnSync("npx", [cmd, ...args], {
    stdio: "inherit",
    shell: true,
    env,
    cwd: path.join(process.cwd(), "packages", "db"),
  });
  process.exit(r.status ?? 1);
}
