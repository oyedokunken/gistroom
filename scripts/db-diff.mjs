// Writes the next migration by diffing the committed schema against the working copy.
// It never touches a database. Usage: npm run db:diff -- add_something
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z0-9_]+$/.test(name)) {
  process.stderr.write(
    "Usage: npm run db:diff -- migration_name (lowercase, digits, underscores)\n",
  );
  process.exit(1);
}
const root = process.cwd();
const schemaRel = "packages/db/prisma/schema.prisma";
const show = spawnSync("git", ["show", `HEAD:${schemaRel}`], { encoding: "utf8", cwd: root });
if (show.status !== 0) {
  process.stderr.write("Could not read the committed schema.\n");
  process.exit(1);
}
const oldFile = path.join(os.tmpdir(), `gistroom-old-${Date.now()}.prisma`);
writeFileSync(oldFile, show.stdout);

const diff = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-schema",
    oldFile,
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
  ],
  {
    encoding: "utf8",
    shell: true,
    cwd: path.join(root, "packages", "db"),
    env: {
      ...process.env,
      DIRECT_URL: process.env.DIRECT_URL ?? "postgresql://u:p@localhost:5432/db",
    },
  },
);
const sql = diff.stdout
  .split("\n")
  .filter((l) => !l.includes("injected env"))
  .join("\n")
  .trim();
if (!sql || sql.startsWith("-- This is an empty migration")) {
  process.stdout.write("No schema changes since the last commit.\n");
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const dir = path.join(root, "packages", "db", "prisma", "migrations", `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "migration.sql"), `${sql}\n`);
process.stdout.write(`Wrote ${path.relative(root, dir)}/migration.sql\n`);
