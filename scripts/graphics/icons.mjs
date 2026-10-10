// Draws the custom Gistroom card icons (96 by 96, flat, brand palette) and exports them as PNG.
// Each icon sits on its own soft round tile, so it reads on light and dark surfaces alike.
// Run: node scripts/graphics/icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const masters = path.join(root, "design", "masters", "icons");
const shipped = path.join(root, "apps", "web", "public", "images", "icons");
mkdirSync(masters, { recursive: true });
mkdirSync(shipped, { recursive: true });

const G = "#0E7A43";
const GD = "#0A5C32";
const GT = "#E4F4EB";
const Y = "#FFC20E";
const YT = "#FFF4CC";
const K = "#0B0B0C";
const W = "#FFFFFF";
const R = "#C62828";
const stroke = (c, w = 4) =>
  `stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
/** Shapes that are only outlined get fill none, shapes with their own fill are left alone. */
const fixFills = (svg) =>
  svg.replace(/<(path|rect|circle|polygon)([^>]*?)(\/?)>/g, (m, tag, attrs, close) =>
    attrs.includes("stroke=") && !/ fill=/.test(attrs) ? `<${tag}${attrs} fill="none"${close}>` : m,
  );

/** A chat bubble with a small tail. */
const bubble = (x, y, w, h, fill, tail = "left") => {
  const tx = tail === "left" ? x + 10 : x + w - 10;
  const dir = tail === "left" ? -1 : 1;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${fill}"/><path d="M${tx} ${y + h - 2} l${6 * dir} 10 l${8 * -dir} -10 Z" fill="${fill}"/>`;
};
const person = (cx, cy, skin, shirt) =>
  `<circle cx="${cx}" cy="${cy}" r="7" fill="${skin}"/><path d="M${cx - 12} ${cy + 26} C${cx - 12} ${cy + 12} ${cx + 12} ${cy + 12} ${cx + 12} ${cy + 26} Z" fill="${shirt}"/>`;
const star = (cx, cy, r, fill) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
};
const shield = (cx, cy, s, fill) =>
  `<path d="M${cx} ${cy - s} L${cx + s * 0.85} ${cy - s * 0.65} V${cy + s * 0.1} C${cx + s * 0.85} ${cy + s * 0.65} ${cx + s * 0.3} ${cy + s * 0.95} ${cx} ${cy + s * 1.1} C${cx - s * 0.3} ${cy + s * 0.95} ${cx - s * 0.85} ${cy + s * 0.65} ${cx - s * 0.85} ${cy + s * 0.1} V${cy - s * 0.65} Z" fill="${fill}"/>`;
const padlock = (cx, cy, fill, shackle = K) =>
  `<path d="M${cx - 8} ${cy - 4} V${cy - 10} A8 8 0 0 1 ${cx + 8} ${cy - 10} V${cy - 4}" ${stroke(shackle, 4)}/><rect x="${cx - 12}" y="${cy - 4}" width="24" height="20" rx="5" fill="${fill}"/><circle cx="${cx}" cy="${cy + 6}" r="3" fill="${K}"/>`;

const ICONS = {
  friends: `${person(34, 36, "#8C5B3A", G)}${person(62, 38, "#5E3825", GD)}<circle cx="66" cy="62" r="11" fill="${Y}"/><path d="M60 62 l4 4 l8 -8" ${stroke(K, 3.5)}/>`,
  voice: `<rect x="38" y="16" width="20" height="36" rx="10" fill="${G}"/><path d="M28 44 C28 60 68 60 68 44" ${stroke(K, 4)}/><path d="M48 58 V70" ${stroke(K, 4)}/><path d="M38 72 H58" ${stroke(K, 4)}/><path d="M18 30 V42 M12 34 V38 M78 30 V42 M84 34 V38" ${stroke(Y, 4)}/>`,
  media: `<rect x="14" y="26" width="50" height="40" rx="6" fill="${W}" ${stroke(K, 3.5)}/><path d="M22 58 L34 44 L42 52 L50 42 L58 58 Z" fill="${G}"/><circle cx="52" cy="36" r="4" fill="${Y}"/><rect x="48" y="38" width="34" height="40" rx="6" fill="${Y}" ${stroke(K, 3.5)}/><path d="M60 50 L72 58 L60 66 Z" fill="${K}"/>`,
  starred: `${bubble(16, 20, 64, 44, G, "left")}${star(48, 42, 16, Y)}`,
  "shield-slash": `${shield(48, 46, 30, G)}<circle cx="48" cy="46" r="15" ${stroke(W, 5)}/><path d="M37 57 L59 35" ${stroke(W, 5)}/>`,
  theme: `<circle cx="48" cy="48" r="26" fill="${K}"/><path d="M48 22 A26 26 0 0 1 48 74 Z" fill="${Y}"/><circle cx="58" cy="40" r="5" fill="${YT}"/><circle cx="36" cy="54" r="9" fill="${GT}"/><circle cx="41" cy="50" r="9" fill="${K}"/>`,
  install: `<rect x="26" y="12" width="44" height="72" rx="9" fill="${K}"/><rect x="31" y="20" width="34" height="52" rx="4" fill="${W}"/><rect x="38" y="52" width="20" height="16" rx="4" fill="${G}"/><path d="M48 24 V44 M40 37 L48 45 L56 37" ${stroke(G, 4)}/><circle cx="48" cy="78" r="2.5" fill="${W}"/>`,
  offline: `<path d="M30 66 C16 66 14 46 30 44 C30 28 56 24 62 42 C80 40 82 66 66 66 Z" fill="${W}" ${stroke(G, 4)}/>${bubble(34, 40, 28, 18, G, "left")}<path d="M22 78 L74 20" ${stroke(R, 5)}/>`,
  respect: `${bubble(12, 22, 38, 30, G, "left")}${bubble(46, 40, 38, 30, Y, "right")}<path d="M24 36 H38 M24 44 H32" ${stroke(W, 3)}/><path d="M58 54 H72 M58 62 H66" ${stroke(K, 3)}/>`,
  "no-hate": `${bubble(12, 18, 44, 34, G, "left")}<path d="M24 32 H44 M24 40 H36" ${stroke(W, 3.5)}/><polygon points="58,44 72,44 82,54 82,68 72,78 58,78 48,68 48,54" fill="${R}"/><rect x="56" y="52" width="4.5" height="13" rx="2.2" fill="${W}"/><rect x="61.5" y="49" width="4.5" height="16" rx="2.2" fill="${W}"/><rect x="67" y="50" width="4.5" height="15" rx="2.2" fill="${W}"/><rect x="72.5" y="53" width="4.5" height="12" rx="2.2" fill="${W}"/><rect x="56" y="62" width="21" height="10" rx="5" fill="${W}"/>`,
  private: `${bubble(12, 20, 54, 40, G, "left")}<path d="M24 36 H52 M24 44 H44" ${stroke(W, 3.5)}/>${padlock(66, 62, Y)}`,
  "no-scams": `<rect x="12" y="30" width="62" height="38" rx="5" fill="${GT}" ${stroke(G, 4)}/><circle cx="43" cy="49" r="9" fill="${G}"/><path d="M20 38 H26 M60 60 H66" ${stroke(G, 3)}/><path d="M70 28 L88 62 H52 Z" fill="${Y}" ${stroke(K, 3.5)}/><path d="M70 40 V52" ${stroke(K, 4)}/><circle cx="70" cy="57" r="2.2" fill="${K}"/>`,
  children: `${shield(48, 46, 32, G)}<circle cx="48" cy="40" r="7" fill="${Y}"/><path d="M38 66 C38 52 58 52 58 66 Z" fill="${Y}"/>`,
  law: `<path d="M48 14 V74 M30 76 H66" ${stroke(K, 4.5)}/><path d="M22 28 H74" ${stroke(K, 4.5)}/><path d="M22 28 L12 52 H32 Z" fill="${Y}" ${stroke(K, 3)}/><path d="M74 28 L64 52 H84 Z" fill="${G}" ${stroke(K, 3)}/><path d="M12 52 C12 62 32 62 32 52 M64 52 C64 62 84 62 84 52" ${stroke(K, 3)}/><circle cx="48" cy="14" r="5" fill="${Y}"/>`,
  block: `${person(44, 34, "#76492F", G)}<circle cx="64" cy="62" r="17" fill="${W}" ${stroke(R, 6)}/><path d="M52 74 L76 50" ${stroke(R, 6)}/>`,
  report: `${bubble(12, 28, 50, 38, G, "left")}<path d="M24 42 H48 M24 50 H40" ${stroke(W, 3.5)}/><path d="M62 14 V52" ${stroke(K, 4.5)}/><path d="M62 16 H86 L78 26 L86 36 H62 Z" fill="${R}"/>`,
  invites: `<rect x="10" y="26" width="60" height="42" rx="6" fill="${W}" ${stroke(G, 4)}/><path d="M12 30 L40 52 L68 30" ${stroke(G, 4)}/><rect x="46" y="44" width="38" height="24" rx="4" fill="${Y}" ${stroke(K, 3.5)} transform="rotate(-8 65 56)"/><circle cx="54" cy="55" r="3" fill="${K}" transform="rotate(-8 65 56)"/><path d="M62 50 V62" stroke="${K}" stroke-width="2.5" stroke-dasharray="3 3" transform="rotate(-8 65 56)"/>`,
  privacy: `<path d="M8 38 C22 16 74 16 88 38 C74 60 22 60 8 38 Z" fill="${W}" ${stroke(G, 4)}/><circle cx="48" cy="38" r="12" fill="${G}"/><circle cx="48" cy="38" r="5" fill="${K}"/><path d="M18 62 L78 14" ${stroke(R, 5)}/><rect x="28" y="68" width="40" height="16" rx="8" fill="${GT}" ${stroke(G, 3.5)}/><circle cx="58" cy="76" r="6" fill="${G}"/>`,
  "private-room": `<rect x="22" y="12" width="44" height="70" rx="4" fill="${G}"/><rect x="28" y="18" width="32" height="58" rx="2" fill="${GD}"/><circle cx="54" cy="48" r="3" fill="${Y}"/>${padlock(66, 62, Y)}`,
};

const manifestFile = path.join(root, "design", "assets.manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const now = new Date().toISOString();

for (const [name, body] of Object.entries(ICONS)) {
  const tile =
    name === "no-hate" || name === "report" || name === "no-scams" || name === "block" ? YT : GT;
  const svg = fixFills(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="46" fill="${tile}"/>${body}</svg>`,
  );
  writeFileSync(path.join(masters, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 288 })
    .resize(192, 192)
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(shipped, `${name}.png`));
  const id = `icon-${name}`;
  const entry = {
    id,
    placement: `Card icon: ${name.replace(/-/g, " ")}`,
    master: `design/masters/icons/${name}.svg`,
    sizes: [{ width: 192, height: 192, file: `icons/${name}.png` }],
    alt: "",
    decorative: true,
    prompt:
      "Drawn in code by scripts/graphics/icons.mjs: flat brand palette icon on a soft round tile, no text.",
    status: "DRAFT",
    createdAt: now,
  };
  const at = manifest.assets.findIndex((a) => a.id === id);
  if (at === -1) manifest.assets.push(entry);
  else manifest.assets[at] = { ...entry, createdAt: manifest.assets[at].createdAt };
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

// A contact sheet for review (not shipped).
const names = Object.keys(ICONS);
const cell = 128;
const sheet = await Promise.all(
  names.map(async (n, i) => ({
    input: await sharp(path.join(shipped, `${n}.png`))
      .resize(cell)
      .toBuffer(),
    left: (i % 7) * cell,
    top: Math.floor(i / 7) * cell,
  })),
);
await sharp({
  create: {
    width: cell * 7,
    height: cell * Math.ceil(names.length / 7),
    channels: 3,
    background: "#ffffff",
  },
})
  .composite(sheet)
  .png()
  .toFile(path.join(process.env.TEMP ?? ".", "icons-sheet.png"));
process.stdout.write(`Wrote ${names.length} icons.\n`);
