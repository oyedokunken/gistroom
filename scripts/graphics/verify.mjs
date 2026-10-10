import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "design", "assets.manifest.json");
if (!existsSync(file)) {
  console.error("lint:graphics failed: design/assets.manifest.json is missing.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(file, "utf8"));
const release = process.env.RELEASE_BUILD === "true";
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(m);
};
for (const a of manifest.assets ?? []) {
  if (!a.alt && !a.decorative) fail(`${a.id}: missing alt text`);
  if (release && a.status === "PLACEHOLDER")
    fail(`${a.id}: still a placeholder in a release build`);
  for (const s of a.sizes ?? []) {
    const p = path.join(process.cwd(), "apps", "web", "public", "images", s.file);
    if (!existsSync(p)) fail(`${a.id}: shipped file ${s.file} is missing`);
  }
}
if (failures) process.exit(1);
console.log(`lint:graphics ok (${(manifest.assets ?? []).length} assets listed)`);
