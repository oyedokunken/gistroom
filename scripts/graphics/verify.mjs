import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "design", "assets.manifest.json");
if (!existsSync(file)) {
  console.error("lint:graphics failed: design/assets.manifest.json is missing.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(file, "utf8"));
const release = process.env.RELEASE_BUILD === "true";
const KB = 1024;
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(m);
};

const required = [
  "logo-mark.png",
  "logo-mark-inverted.png",
  "logo-mark-mono.png",
  "wordmark.png",
  "lockup-horizontal.png",
  "lockup-stacked.png",
  "favicon.ico",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png",
  "badge-96.png",
  "og-default.png",
];
for (const f of required) {
  if (!existsSync(path.join(root, "apps", "web", "public", "brand", f)))
    fail(`brand file ${f} is missing, run npm run brand`);
}

for (const a of manifest.assets ?? []) {
  if (!a.alt && !a.decorative) fail(`${a.id}: missing alt text`);
  if (release && a.status === "PLACEHOLDER")
    fail(`${a.id}: still a placeholder in a release build`);
  for (const s of a.sizes ?? []) {
    const p = path.join(root, "apps", "web", "public", "images", s.file);
    if (!existsSync(p)) {
      fail(`${a.id}: shipped file ${s.file} is missing`);
      continue;
    }
    const kb = statSync(p).size / KB;
    const budget = a.id === "hero-back" || a.id === "hero-mid" ? 250 : 180;
    if (kb > budget) fail(`${a.id}: ${s.file} is ${Math.round(kb)} KB, budget is ${budget} KB`);
  }
}
if (failures) process.exit(1);
const n = (manifest.assets ?? []).length;
const ph = (manifest.assets ?? []).filter((a) => a.status === "PLACEHOLDER").length;
console.log(`lint:graphics ok (${n} assets, ${ph} placeholders)`);
