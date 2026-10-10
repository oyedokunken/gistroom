import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkText, stripCoAuthor } from "./lib/copy-rules.mjs";

const root = process.cwd();
const SKIP_DIRS = new Set([
  "generated",
  "node_modules",
  ".next",
  "dist",
  ".git",
  ".mail-preview",
  "coverage",
  "test-results",
  "playwright-report",
  ".vercel",
]);
const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".html",
  ".prisma",
  ".yml",
  ".yaml",
  ".txt",
  ".sql",
  ".svg",
]);
// These files must name the forbidden things in order to define them.
const SKIP_FILES = new Set([
  // Written by next dev, not by us.
  path.join("apps", "web", "AGENTS.md"),
  "CLAUDE.md",
  "package-lock.json",
  path.join("scripts", "banned-phrases.json"),
  path.join("scripts", "lib", "copy-rules.mjs"),
]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (TEXT_EXT.has(path.extname(name))) out.push(full);
  }
}

const args = process.argv.slice(2);
let failures = 0;

function report(file, text) {
  for (const p of checkText(text)) {
    failures += 1;
    console.error(`${path.relative(root, file)}:${p.line}:${p.column} ${p.message}`);
  }
}

if (args[0] === "--commit-msg") {
  const file = args[1];
  const raw = readFileSync(file, "utf8");
  const cleaned = stripCoAuthor(raw);
  if (cleaned !== raw) writeFileSync(file, cleaned.endsWith("\n") ? cleaned : `${cleaned}\n`);
  report(file, cleaned);
} else {
  let files = [];
  if (args[0] === "--files") files = args.slice(1).map((f) => path.resolve(f));
  else walk(root, files);
  for (const file of files) {
    const rel = path.relative(root, file);
    if (SKIP_FILES.has(rel) || !TEXT_EXT.has(path.extname(file))) continue;
    report(file, readFileSync(file, "utf8"));
  }
}

if (failures > 0) {
  console.error(`\nlint:copy failed with ${failures} problem(s).`);
  process.exit(1);
}
console.log("lint:copy ok");
