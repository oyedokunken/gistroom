// Regenerates the logo sources and every brand export (Section 17.6). Run: npm run brand
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = process.cwd();
const logoDir = path.join(root, "design", "masters", "logo");
const outDir = path.join(root, "apps", "web", "public", "brand");
const fontFiles = ["Graphik-Bold.ttf", "Graphik-Regular.ttf", "Graphik-Black.ttf"].map((f) =>
  path.join(root, "design", "fonts", f),
);
mkdirSync(logoDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const C = {
  green: "#0E7A43",
  green100: "#E4F4EB",
  yellow: "#FFC20E",
  ink: "#0B0B0C",
  white: "#FFFFFF",
};

/**
 * The mark: a speech bubble that forms a lowercase g, with three sound bars in the bowl.
 * 512 by 512 canvas, artwork inside the central 80 percent.
 */
function markGroup({ bubble, bars }) {
  const [b1, b2, b3] = bars;
  return `
  <circle cx="236" cy="236" r="150" fill="${bubble}"/>
  <path d="M372 150 V318 Q372 410 272 410 H190" fill="none" stroke="${bubble}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M170 392 L128 452 L212 432 Z" fill="${bubble}"/>
  <rect x="172" y="196" width="34" height="80" rx="17" fill="${b1}"/>
  <rect x="219" y="150" width="34" height="172" rx="17" fill="${b2}"/>
  <rect x="266" y="178" width="34" height="116" rx="17" fill="${b3}"/>`;
}

const svg = (inner, w = 512, h = 512, bg = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${inner}</svg>`;

const marks = {
  mark: svg(markGroup({ bubble: C.ink, bars: [C.green, C.yellow, C.green] })),
  "mark-inverted": svg(markGroup({ bubble: C.white, bars: [C.green, C.yellow, C.green] })),
  "mark-mono": svg(markGroup({ bubble: C.ink, bars: [C.white, C.white, C.white] })),
  "mark-mono-white": svg(markGroup({ bubble: C.white, bars: [C.ink, C.ink, C.ink] })),
};

function tile(inner, radius) {
  return svg(`<rect width="512" height="512" rx="${radius}" fill="${C.green}"/>${inner}`);
}

/** Inverted mark scaled into a green tile. Scale shrinks the artwork for the maskable safe zone. */
function iconTile(scale, radius) {
  const t = 256 - 256 * scale;
  return tile(
    `<g transform="translate(${t} ${t - 10 * scale}) scale(${scale})">${markGroup({ bubble: C.white, bars: [C.green, C.yellow, C.green] })}</g>`,
    radius,
  );
}

function render(source, width, { fonts = false, background } = {}) {
  const r = new Resvg(source, {
    fitTo: { mode: "width", value: width },
    background,
    font: fonts
      ? { fontFiles, loadSystemFonts: false, defaultFontFamily: "Graphik" }
      : { loadSystemFonts: false },
  });
  return r.render().asPng();
}

function write(file, buf) {
  writeFileSync(file, buf);
  console.log(`brand: ${path.relative(root, file)}`);
}

// ---- Sources ----
for (const [name, source] of Object.entries(marks)) {
  writeFileSync(path.join(logoDir, `${name}.svg`), source);
}

// Wordmark: lowercase gistroom in Graphik Bold, tight tracking.
const wordmark = (fill) =>
  svg(
    `<text x="0" y="150" font-family="Graphik" font-weight="700" font-size="170" letter-spacing="-6" fill="${fill}">gistroom</text>`,
    780,
    220,
  );
const horizontal = (textFill, m) =>
  svg(
    `<g transform="scale(0.5) translate(0 0)">${m}</g>
     <text x="270" y="190" font-family="Graphik" font-weight="700" font-size="150" letter-spacing="-5" fill="${textFill}">gistroom</text>`,
    1100,
    256,
  );
const inner = (key, bubble, bars) => markGroup({ bubble, bars });
const stacked = (textFill, bubble, bars) =>
  svg(
    `<g transform="translate(144 0)">${inner("m", bubble, bars)}</g>
     <text x="400" y="610" text-anchor="middle" font-family="Graphik" font-weight="700" font-size="150" letter-spacing="-5" fill="${textFill}">gistroom</text>`,
    800,
    680,
  );

const lockups = {
  wordmark: wordmark(C.ink),
  "wordmark-inverted": wordmark(C.white),
  "lockup-horizontal": horizontal(C.ink, inner("m", C.ink, [C.green, C.yellow, C.green])),
  "lockup-horizontal-inverted": horizontal(
    C.white,
    inner("m", C.white, [C.green, C.yellow, C.green]),
  ),
  "lockup-horizontal-green": horizontal(C.green, inner("m", C.green, [C.white, C.yellow, C.white])),
  "lockup-horizontal-green-black": horizontal(
    C.ink,
    inner("m", C.green, [C.white, C.yellow, C.white]),
  ),
  "lockup-stacked": stacked(C.ink, C.ink, [C.green, C.yellow, C.green]),
  "lockup-stacked-mono": stacked(C.ink, C.ink, [C.white, C.white, C.white]),
};
for (const [name, source] of Object.entries(lockups)) {
  writeFileSync(path.join(logoDir, `${name}.svg`), source);
}

// ---- Exports ----
write(path.join(outDir, "logo-mark.png"), render(marks.mark, 512));
write(path.join(outDir, "logo-mark-inverted.png"), render(marks["mark-inverted"], 512));
write(path.join(outDir, "logo-mark-mono.png"), render(marks["mark-mono"], 512));
for (const [name, source] of Object.entries(lockups)) {
  write(
    path.join(outDir, `${name}.png`),
    render(source, name.startsWith("wordmark") ? 780 : 1100, { fonts: true }),
  );
}

write(path.join(outDir, "icon-192.png"), render(iconTile(1, 112), 192));
write(path.join(outDir, "icon-512.png"), render(iconTile(1, 112), 512));
// Maskable: full bleed square, artwork inside the central 80 percent safe zone.
write(path.join(outDir, "icon-maskable-512.png"), render(iconTile(0.72, 0), 512));
write(path.join(outDir, "apple-touch-icon.png"), render(iconTile(0.86, 0), 180));
// Monochrome white on transparent, used as the push notification badge.
write(
  path.join(outDir, "badge-96.png"),
  render(marks["mark-mono-white"].replace(`fill="${C.ink}"`, `fill="${C.white}"`), 96),
);

// favicon.ico with 16, 32 and 48 pixel PNG frames.
function ico(sizes) {
  const pngs = sizes.map((s) => render(iconTile(1, 112), s));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const dirs = pngs.map((png, i) => {
    const d = Buffer.alloc(16);
    const s = sizes[i];
    d.writeUInt8(s, 0);
    d.writeUInt8(s, 1);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(png.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += png.length;
    return d;
  });
  return Buffer.concat([header, ...dirs, ...pngs]);
}
write(path.join(outDir, "favicon.ico"), ico([16, 32, 48]));

// Default Open Graph image, 1200 by 630. Text is composed with the real Graphik files (Section 17.4).
const og = svg(
  `<rect width="1200" height="630" fill="${C.green}"/>
   <circle cx="1060" cy="90" r="260" fill="${C.green100}" opacity="0.10"/>
   <circle cx="1130" cy="600" r="200" fill="${C.yellow}" opacity="0.95"/>
   <g transform="translate(60 20) scale(0.78)">${markGroup({ bubble: C.white, bars: [C.green, C.yellow, C.green] })}</g>
   <text x="70" y="568" font-family="Graphik" font-weight="900" font-size="100" letter-spacing="-4" fill="${C.white}">Come gist. Properly.</text>
   <text x="500" y="230" font-family="Graphik" font-weight="700" font-size="88" letter-spacing="-3" fill="${C.white}">gistroom</text>
   <text x="500" y="300" font-family="Graphik" font-weight="400" font-size="34" fill="${C.white}">Live talk about Nigeria, in Nigeria.</text>`,
  1200,
  630,
);
write(path.join(outDir, "og-default.png"), render(og, 1200, { fonts: true }));
