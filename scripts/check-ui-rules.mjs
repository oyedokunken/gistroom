import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { checkSource } from "./lib/ui-rules.mjs";

const root = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".next-e2e", "dist", "fonts"]);
const targets = ["apps/web/src", "apps/realtime/src", "packages/shared/src"];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
}

let failures = 0;
for (const t of targets) {
  const dir = path.join(root, t);
  if (!existsSync(dir)) continue;
  const files = [];
  walk(dir, files);
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join("/");
    for (const p of checkSource(rel, readFileSync(f, "utf8"))) {
      failures += 1;
      console.error(`${rel}:${p.line} [${p.rule}] ${p.message}`);
    }
  }
}
if (failures > 0) {
  console.error(`\nlint:ui failed with ${failures} problem(s).`);
  process.exit(1);
}
console.log("lint:ui ok");
