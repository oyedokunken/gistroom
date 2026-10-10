// Open Graph share images, 1200 x 630, in the flat style.
// Two variants: og-green.png (green-700 field) and og-white.png (white field).
// Run: node scripts/graphics/og.mjs

import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd(), "apps/web/public/brand");
const ICONS_DIR = path.resolve(process.cwd(), "apps/web/public/images/icons");

const C = {
  green: "#0E7A43",
  greenDark: "#0B5A33",
  yellow: "#FFC20E",
  ink: "#0B0B0C",
  inkSoft: "#3E3F44",
  white: "#FFFFFF",
  cream: "#FFF7E0",
  greenTint: "#DDEEE4",
};

const W = 1200;
const H = 630;

/** The Gistroom mark drawn by hand so no external SVG rasterising is needed. */
function mark(cx, cy, s, { bubble, bars }) {
  const u = s / 512; // mark.svg is drawn on a 512 box
  const p = (v) => v * u;
  const x = cx - p(236);
  const y = cy - p(236);
  return (
    `<circle cx="${cx}" cy="${cy}" r="${p(150)}" fill="${bubble}"/>` +
    `<path d="M${x + p(372)} ${y + p(150)} V${y + p(318)} Q${x + p(372)} ${y + p(410)} ${x + p(272)} ${y + p(410)} H${x + p(190)}" fill="none" stroke="${bubble}" stroke-width="${p(64)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${x + p(170)} ${y + p(392)} L${x + p(128)} ${y + p(452)} L${x + p(212)} ${y + p(432)} Z" fill="${bubble}"/>` +
    `<rect x="${x + p(172)}" y="${y + p(196)}" width="${p(34)}" height="${p(80)}" rx="${p(17)}" fill="${bars[0]}"/>` +
    `<rect x="${x + p(219)}" y="${y + p(150)}" width="${p(34)}" height="${p(172)}" rx="${p(17)}" fill="${bars[1]}"/>` +
    `<rect x="${x + p(266)}" y="${y + p(178)}" width="${p(34)}" height="${p(116)}" rx="${p(17)}" fill="${bars[2]}"/>`
  );
}

function dots(spacing, r, color, opacity) {
  let d = "";
  for (let y = spacing / 2; y < H; y += spacing) {
    for (let x = spacing / 2; x < W; x += spacing) {
      d += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}"/>`;
    }
  }
  return d;
}

function iconChip(name, cx, cy, r, ring) {
  const png = readFileSync(path.join(ICONS_DIR, `${name}.png`)).toString("base64");
  const inner = r - 14;
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="${ring}" stroke-width="5"/>` +
    `<image href="data:image/png;base64,${png}" x="${cx - inner}" y="${cy - inner}" width="${inner * 2}" height="${inner * 2}"/>`
  );
}

function build(variant) {
  const green = variant === "green";
  const bg = green ? C.green : C.white;
  const head = green ? C.white : C.ink;
  const sub = green ? "rgba(255,255,255,0.85)" : C.inkSoft;
  const dot = green ? C.white : C.green;
  const word = green ? C.white : C.ink;
  const bubble = green ? C.white : C.ink;
  const bars = green ? [C.green, C.yellow, C.green] : [C.green, C.yellow, C.green];
  const icons = ["voice", "friends", "football", "food-and-chop"];

  const iconRow = icons
    .map((n, i) =>
      iconChip(n, 112 + i * 128, 530, 52, green ? "rgba(255,255,255,0.35)" : C.greenTint),
    )
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${bg}"/>` +
    dots(46, 2.4, dot, green ? 0.1 : 0.12) +
    `<circle cx="1105" cy="90" r="260" fill="${green ? "rgba(0,0,0,0.12)" : C.greenTint}"/>` +
    `<circle cx="115" cy="620" r="170" fill="${C.yellow}" opacity="${green ? 0.9 : 0.55}"/>` +
    mark(950, 300, 340, { bubble, bars }) +
    `<circle cx="950" cy="300" r="215" fill="none" stroke="${green ? C.yellow : C.green}" stroke-width="6" stroke-dasharray="6 14"/>` +
    mark(112, 96, 66, { bubble, bars }) +
    `<text x="160" y="118" font-family="'Arial Black', Arial, sans-serif" font-size="42" font-weight="900" fill="${word}">gistroom</text>` +
    `<text x="80" y="285" font-family="'Arial Black', Arial, sans-serif" font-size="96" font-weight="900" fill="${head}" letter-spacing="-2">Come gist.</text>` +
    `<text x="80" y="390" font-family="'Arial Black', Arial, sans-serif" font-size="96" font-weight="900" fill="${C.yellow}" letter-spacing="-2">Properly.</text>` +
    `<text x="82" y="452" font-family="Arial, sans-serif" font-size="30" fill="${sub}">Live audio rooms for Nigerians, by a Nigerian.</text>` +
    iconRow +
    `</svg>`
  );
}

await mkdir(ROOT, { recursive: true });
for (const variant of ["green", "white"]) {
  const out = path.join(ROOT, `og-${variant}.png`);
  await sharp(Buffer.from(build(variant)), { density: 144 })
    .png()
    .toFile(out);
  console.log(`wrote ${out}`);
}
