// Draws the small status icons for form feedback: a check, a cross and a spinning ring (animated WebP with a still PNG).
// Run: node scripts/graphics/status-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const masters = path.join(root, "design", "masters", "status");
const out = path.join(root, "apps", "web", "public", "images", "status");
mkdirSync(masters, { recursive: true });
mkdirSync(out, { recursive: true });

const G = "#0E7A43";
const GT = "#E4F4EB";
const R = "#C62828";
const SIZE = 96;
const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 96 96">${body}</svg>`;
const round = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';

const check = wrap(
  `<circle cx="48" cy="48" r="44" fill="${G}"/><path d="M27 50 L42 65 L70 33" stroke="#fff" stroke-width="10" ${round}/>`,
);
const cross = wrap(
  `<circle cx="48" cy="48" r="44" fill="${R}"/><path d="M32 32 L64 64 M64 32 L32 64" stroke="#fff" stroke-width="10" ${round}/>`,
);
/** A ring with a bright quarter that sweeps round. The angle moves the sweep. */
const spinner = (angle) =>
  wrap(
    `<circle cx="48" cy="48" r="36" stroke="${GT}" stroke-width="12" fill="none"/>` +
      `<g transform="rotate(${angle} 48 48)"><path d="M48 12 A36 36 0 0 1 84 48" stroke="${G}" stroke-width="12" ${round}/></g>`,
  );

const manifestFile = path.join(root, "design", "assets.manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const now = new Date().toISOString();
const put = (entry) => {
  const at = manifest.assets.findIndex((a) => a.id === entry.id);
  if (at === -1) manifest.assets.push(entry);
  else manifest.assets[at] = { ...entry, createdAt: manifest.assets[at].createdAt };
};

const still = async (name, svg, alt) => {
  writeFileSync(path.join(masters, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(192, 192)
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(out, `${name}.png`));
  return {
    id: `status-${name}`,
    placement: `Form status icon: ${name}`,
    master: `design/masters/status/${name}.svg`,
    sizes: [{ width: 192, height: 192, file: `status/${name}.png` }],
    alt,
    decorative: alt === "",
    prompt:
      "Drawn in code by scripts/graphics/status-icons.mjs: flat brand palette status icon, no text.",
    status: "DRAFT",
    createdAt: now,
  };
};

put(await still("check", check, ""));
put(await still("cross", cross, ""));

// The spinner: twelve frames, one full turn, looping forever. The still PNG is the same ring at rest.
const spin = await still("spinner", spinner(0), "");
const FRAMES = 12;
const frames = [];
for (let f = 0; f < FRAMES; f++) {
  frames.push(
    await sharp(Buffer.from(spinner((360 / FRAMES) * f)), { density: 144 })
      .resize(96, 96)
      .ensureAlpha()
      .raw()
      .toBuffer(),
  );
}
const info = await sharp(Buffer.concat(frames), {
  raw: { width: 96, height: 96 * FRAMES, channels: 4, pageHeight: 96 },
})
  .webp({ quality: 80, alphaQuality: 90, effort: 5, loop: 0, delay: Array(FRAMES).fill(70) })
  .toFile(path.join(out, "spinner.webp"));
put({
  ...spin,
  animated: true,
  static: "status/spinner.png",
  loopCount: 0,
  sizes: [
    ...spin.sizes,
    { width: 96, height: 96, file: "status/spinner.webp", animated: true, bytes: info.size },
  ],
});

writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
process.stdout.write(`status icons ok, spinner ${Math.round(info.size / 1024)} KB\n`);
