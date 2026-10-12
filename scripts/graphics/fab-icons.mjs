// Draws the glyphs for the floating button, one per place: chat, call, friends, room and discover.
// White and yellow shapes on a transparent background, because they sit on the green button.
// Run: node scripts/graphics/fab-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const masters = path.join(root, "design", "masters", "fab");
const out = path.join(root, "apps", "web", "public", "images", "fab");
mkdirSync(masters, { recursive: true });
mkdirSync(out, { recursive: true });

const G = "#0E7A43";
const Y = "#FFC20E";
const W = "#FFFFFF";
const round = 'stroke-linecap="round" stroke-linejoin="round"';

const GLYPHS = {
  chat: `<path d="M20 22 H76 A10 10 0 0 1 86 32 V58 A10 10 0 0 1 76 68 H46 L28 82 V68 H20 A10 10 0 0 1 10 58 V32 A10 10 0 0 1 20 22 Z" fill="${W}"/><circle cx="32" cy="45" r="5" fill="${G}"/><circle cx="48" cy="45" r="5" fill="${G}"/><circle cx="64" cy="45" r="5" fill="${G}"/><circle cx="78" cy="22" r="11" fill="${Y}"/><path d="M78 16 V28 M72 22 H84" stroke="${G}" stroke-width="4" ${round}/>`,
  call: `<path d="M26 14 C20 14 14 20 15 28 C18 52 44 78 68 81 C76 82 82 76 82 70 L82 62 C82 59 80 57 78 56 L66 52 C64 51 61 52 59 54 L55 58 C46 54 40 48 36 39 L40 35 C42 33 43 30 42 28 L38 16 C37 15 36 14 34 14 Z" fill="${W}"/><path d="M60 24 A22 22 0 0 1 78 42" stroke="${Y}" stroke-width="6" fill="none" ${round}/><path d="M60 10 A36 36 0 0 1 90 40" stroke="${Y}" stroke-width="6" fill="none" ${round}/>`,
  friends: `<circle cx="38" cy="30" r="14" fill="${W}"/><path d="M10 78 C10 58 24 50 38 50 C52 50 66 58 66 78 Z" fill="${W}"/><circle cx="72" cy="62" r="17" fill="${Y}"/><path d="M72 53 V71 M63 62 H81" stroke="${G}" stroke-width="5" ${round}/>`,
  room: `<rect x="34" y="10" width="28" height="48" rx="14" fill="${W}"/><path d="M22 44 C22 64 74 64 74 44" stroke="${W}" stroke-width="7" fill="none" ${round}/><path d="M48 66 V82 M34 84 H62" stroke="${W}" stroke-width="7" fill="none" ${round}/><path d="M12 28 V40 M84 28 V40" stroke="${Y}" stroke-width="6" ${round}/><path d="M4 33 V35 M92 33 V35" stroke="${Y}" stroke-width="6" ${round}/>`,
  discover: `<circle cx="48" cy="48" r="34" fill="none" stroke="${W}" stroke-width="7"/><path d="M62 34 L53 54 L34 62 L43 42 Z" fill="${Y}" stroke="${W}" stroke-width="3" ${round}/><circle cx="48" cy="48" r="4" fill="${G}"/>`,
};

const manifestFile = path.join(root, "design", "assets.manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const now = new Date().toISOString();

for (const [name, body] of Object.entries(GLYPHS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${body}</svg>`;
  writeFileSync(path.join(masters, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, `${name}.png`));
  const entry = {
    id: `fab-${name}`,
    placement: `Floating button glyph: ${name}`,
    master: `design/masters/fab/${name}.svg`,
    sizes: [{ width: 192, height: 192, file: `fab/${name}.png` }],
    alt: "",
    decorative: true,
    prompt:
      "Drawn in code by scripts/graphics/fab-icons.mjs: white and yellow glyph for the green floating button, no text.",
    status: "DRAFT",
    createdAt: now,
  };
  const at = manifest.assets.findIndex((a) => a.id === entry.id);
  if (at === -1) manifest.assets.push(entry);
  else manifest.assets[at] = { ...entry, createdAt: manifest.assets[at].createdAt };
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

// A review sheet on green, not shipped.
const names = Object.keys(GLYPHS);
const cell = 128;
const sheet = await Promise.all(
  names.map(async (n, i) => ({
    input: await sharp(path.join(out, `${n}.png`))
      .resize(96)
      .toBuffer(),
    left: i * cell + 16,
    top: 16,
  })),
);
await sharp({
  create: { width: cell * names.length, height: cell, channels: 3, background: G },
})
  .composite(sheet)
  .png()
  .toFile(path.join(process.env.TEMP ?? ".", "fab-sheet.png"));
process.stdout.write(`Wrote ${names.length} floating button glyphs.\n`);
