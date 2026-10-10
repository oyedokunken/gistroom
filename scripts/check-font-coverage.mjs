import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";

// Code points the product must render (Section 14). Built from numbers so this file stays plain ASCII.
const required = {
  naira: [0x20a6],
  yorubaIgbo: [
    0x1eb9, 0x1ecd, 0x1e63, 0x1ecb, 0x1ee5, 0x1e45, 0x1eb8, 0x1ecc, 0x1e62, 0x1eca, 0x1ee4, 0x1e44,
  ],
  combining: [0x0323, 0x0300, 0x0301, 0x0304],
  hausa: [0x0253, 0x0257, 0x0199, 0x01b4, 0x0181, 0x018a, 0x0198, 0x01b3],
};

const fmt = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
const dir = path.join(process.cwd(), "design", "fonts");
const files = ["Graphik-Regular.ttf", "Graphik-Semibold.ttf", "Graphik-Bold.ttf"];
const missing = new Set();
for (const f of files) {
  const font = fontkit.create(readFileSync(path.join(dir, f)));
  for (const cps of Object.values(required)) {
    for (const cp of cps) if (!font.hasGlyphForCodePoint(cp)) missing.add(cp);
  }
}

if (process.argv.includes("--report")) {
  console.log(missing.size ? [...missing].map(fmt).join("\n") : "full coverage");
  process.exit(0);
}

// Graphik lacks these, so the self-hosted Noto Sans subsets must cover every one of them.
const fbDir = path.join(process.cwd(), "apps", "web", "public", "fonts", "noto-sans");
const fallbacks = ["latin", "latin-ext", "vietnamese"].map((n) =>
  fontkit.create(readFileSync(path.join(fbDir, `noto-sans-${n}-400-normal.woff2`))),
);
const uncovered = [...missing].filter((cp) => !fallbacks.some((f) => f.hasGlyphForCodePoint(cp)));
if (uncovered.length) {
  console.error(`lint:font failed, no font covers: ${uncovered.map(fmt).join(", ")}`);
  process.exit(1);
}
console.log(
  missing.size
    ? `lint:font ok, ${missing.size} glyph(s) fall back to Noto Sans (see wiki/Design-System.md)`
    : "lint:font ok, full glyph coverage",
);
