// Draws the 16 illustrated Nigerian avatars as flat vector art and exports them as 256 px PNGs.
// Run: node scripts/graphics/avatars.mjs. Masters (SVG) go to design/masters/avatars, shipped PNGs to public/images/avatars.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const masters = path.join(root, "design", "masters", "avatars");
const shipped = path.join(root, "apps", "web", "public", "images", "avatars");
mkdirSync(masters, { recursive: true });
mkdirSync(shipped, { recursive: true });

// Brand palette (the same values as the design tokens) plus natural skin and hair tones.
const C = {
  green: "#0E7A43",
  greenDark: "#0A5C32",
  greenTint: "#E4F4EB",
  yellow: "#FFC20E",
  yellowTint: "#FFF4CC",
  ink: "#0B0B0C",
  ink700: "#3A3A3F",
  grey: "#F1F1F3",
  white: "#FFFFFF",
};
const SKIN = ["#4A2C1D", "#5E3825", "#76492F", "#8C5B3A", "#A47049", "#BE8A62"];
const SKIN_SHADE = ["#3A2216", "#4B2C1D", "#5E3A25", "#714A2E", "#855B3A", "#9C7050"];
const HAIR = "#1A1210";

/** name, skin index, hair style, headwear, glasses, clothing, backdrop colour */
const PEOPLE = [
  { name: "Ada", sex: "f", skin: 2, hair: "gele", cap: C.yellow, cloth: "ankara", bg: C.greenTint },
  { name: "Tunde", sex: "m", skin: 1, hair: "fila", cap: C.green, cloth: "tee", bg: C.yellowTint },
  {
    name: "Emeka",
    sex: "m",
    skin: 3,
    hair: "low",
    glasses: true,
    cloth: "ankara",
    bg: C.greenTint,
  },
  {
    name: "Zainab",
    sex: "f",
    skin: 4,
    hair: "hijab",
    cap: C.green,
    cloth: "plain",
    bg: C.yellowTint,
  },
  { name: "Chidi", sex: "m", skin: 0, hair: "locs", cloth: "tee", bg: C.greenTint },
  { name: "Ngozi", sex: "f", skin: 1, hair: "braids", cloth: "ankara", bg: C.yellowTint },
  { name: "Bayo", sex: "m", skin: 3, hair: "afro", cloth: "jersey", bg: C.greenTint },
  {
    name: "Hauwa",
    sex: "f",
    skin: 3,
    hair: "hijab",
    cap: C.yellow,
    cloth: "plain",
    bg: C.greenTint,
  },
  { name: "Kemi", sex: "f", skin: 0, hair: "afro", glasses: true, cloth: "tee", bg: C.yellowTint },
  { name: "Ifeanyi", sex: "m", skin: 4, hair: "low", cloth: "tee", bg: C.greenTint },
  {
    name: "Funke",
    sex: "f",
    skin: 2,
    hair: "gele",
    cap: C.green,
    cloth: "plain",
    bg: C.yellowTint,
  },
  { name: "Musa", sex: "m", skin: 1, hair: "kufi", cap: C.white, cloth: "plain", bg: C.greenTint },
  { name: "Amaka", sex: "f", skin: 3, hair: "locs", cloth: "ankara", bg: C.yellowTint },
  {
    name: "Seun",
    sex: "m",
    skin: 2,
    hair: "cornrows",
    glasses: true,
    cloth: "tee",
    bg: C.greenTint,
  },
  {
    name: "Halima",
    sex: "f",
    skin: 5,
    hair: "scarf",
    cap: C.yellow,
    cloth: "ankara",
    bg: C.greenTint,
  },
  { name: "Obinna", sex: "m", skin: 0, hair: "low", cloth: "jersey", bg: C.yellowTint },
];

const cx = 128;

function clothing(p, skin) {
  const s = [];
  // Shoulders and neck.
  const base = { ankara: C.green, tee: C.ink700, plain: C.white, jersey: C.white }[p.cloth];
  s.push(`<path d="M28 256 C28 206 70 186 128 186 C186 186 228 206 228 256 Z" fill="${base}"/>`);
  if (p.cloth === "plain")
    s.push(
      `<path d="M28 256 C28 206 70 186 128 186 C186 186 228 206 228 256 Z" fill="none" stroke="${C.grey}" stroke-width="3"/>`,
    );
  if (p.cloth === "ankara") {
    for (let i = 0; i < 12; i++) {
      const x = 52 + (i % 6) * 26 + (Math.floor(i / 6) % 2) * 13;
      const y = 214 + Math.floor(i / 6) * 22;
      s.push(
        `<circle cx="${x}" cy="${y}" r="6" fill="${C.yellow}"/><circle cx="${x}" cy="${y}" r="2.5" fill="${C.greenDark}"/>`,
      );
    }
  }
  if (p.cloth === "jersey") {
    s.push(
      `<rect x="28" y="196" width="200" height="14" fill="${C.green}"/><rect x="28" y="224" width="200" height="14" fill="${C.green}"/>`,
    );
    s.push(`<path d="M104 186 L128 214 L152 186" fill="${C.green}"/>`);
  }
  // Neck.
  s.push(`<rect x="108" y="150" width="40" height="44" rx="16" fill="${skin}"/>`);
  if (p.cloth === "tee" || p.cloth === "ankara")
    s.push(`<path d="M104 188 Q128 208 152 188" fill="${skin}"/>`);
  return s.join("");
}

function hairBack(p) {
  switch (p.hair) {
    case "afro":
      return `<circle cx="${cx}" cy="94" r="${p.sex === "f" ? 70 : 62}" fill="${HAIR}"/>`;
    case "locs":
      return (
        [-52, -38, -24, 24, 38, 52]
          .map(
            (dx, i) =>
              `<rect x="${cx + dx - 6}" y="${70 + (i % 2) * 6}" width="12" height="${96 - (i % 3) * 8}" rx="6" fill="${HAIR}"/>`,
          )
          .join("") + `<ellipse cx="${cx}" cy="92" rx="54" ry="48" fill="${HAIR}"/>`
      );
    case "braids":
      return (
        [-50, -36, -22, 22, 36, 50]
          .map(
            (dx) =>
              `<path d="M${cx + dx} 80 Q${cx + dx * 1.15} 140 ${cx + dx * 1.05} 190" stroke="${HAIR}" stroke-width="9" stroke-linecap="round" fill="none"/>`,
          )
          .join("") + `<ellipse cx="${cx}" cy="92" rx="54" ry="48" fill="${HAIR}"/>`
      );
    case "hijab":
      return `<path d="M52 150 C40 70 80 38 128 38 C176 38 216 70 204 150 C200 190 170 200 128 200 C86 200 56 190 52 150 Z" fill="${p.cap}"/>`;
    case "scarf":
      return `<ellipse cx="${cx}" cy="96" rx="56" ry="52" fill="${HAIR}"/>`;
    default:
      return "";
  }
}

function hairFront(p) {
  switch (p.hair) {
    case "low":
      return `<path d="M82 98 C80 62 104 52 128 52 C152 52 176 62 174 98 C164 80 148 74 128 74 C108 74 92 80 82 98 Z" fill="${HAIR}"/>`;
    case "afro":
      return `<path d="M80 100 C80 72 100 62 128 62 C156 62 176 72 176 100 C164 84 148 80 128 80 C108 80 92 84 80 100 Z" fill="${HAIR}"/>`;
    case "fila":
      return (
        `<path d="M76 92 C76 56 98 40 128 40 C158 40 180 56 180 92 L170 92 C168 74 150 66 128 66 C106 66 88 74 86 92 Z" fill="${p.cap}"/>` +
        `<rect x="74" y="86" width="108" height="14" rx="7" fill="${C.yellow}"/>`
      );
    case "kufi":
      return `<path d="M84 90 C84 62 104 50 128 50 C152 50 172 62 172 90 Z" fill="${p.cap}"/><rect x="82" y="84" width="92" height="10" rx="5" fill="${C.green}"/>`;
    case "cornrows":
      return (
        `<path d="M82 98 C80 62 104 52 128 52 C152 52 176 62 174 98 C164 80 148 74 128 74 C108 74 92 80 82 98 Z" fill="${HAIR}"/>` +
        [0, 1, 2, 3, 4]
          .map(
            (i) =>
              `<path d="M${100 + i * 14} 56 L${96 + i * 16} 82" stroke="${C.ink700}" stroke-width="2.5" stroke-linecap="round"/>`,
          )
          .join("")
      );
    case "braids":
    case "locs":
      return `<path d="M80 104 C78 64 104 54 128 54 C152 54 178 64 176 104 C166 84 148 78 128 78 C108 78 90 84 80 104 Z" fill="${HAIR}"/>`;
    case "gele":
      return (
        `<path d="M70 92 C64 56 96 30 128 30 C160 30 192 56 186 92 C176 78 156 70 128 70 C100 70 80 78 70 92 Z" fill="${p.cap}"/>` +
        `<path d="M86 52 C110 40 146 40 170 52 M80 66 C108 52 148 52 176 66" stroke="${C.greenDark}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
        `<path d="M172 44 C196 26 212 38 200 64 C188 56 180 52 172 44 Z" fill="${p.cap}"/>`
      );
    case "hijab":
      return `<path d="M72 112 C68 70 98 52 128 52 C158 52 188 70 184 112 C176 92 156 82 128 82 C100 82 80 92 72 112 Z" fill="${p.cap}"/>`;
    case "scarf":
      return (
        `<path d="M72 100 C70 60 100 46 128 46 C156 46 186 60 184 100 C174 80 154 72 128 72 C102 72 82 80 72 100 Z" fill="${HAIR}"/>` +
        `<path d="M70 82 C94 62 164 62 188 82 L186 96 C160 80 98 80 72 96 Z" fill="${p.cap}"/>`
      );
    default:
      return "";
  }
}

function face(p, skin, shade) {
  const eyeY = 118;
  const parts = [];
  parts.push(`<ellipse cx="${cx}" cy="112" rx="46" ry="54" fill="${skin}"/>`);
  parts.push(
    `<circle cx="${cx - 47}" cy="118" r="9" fill="${skin}"/><circle cx="${cx + 47}" cy="118" r="9" fill="${skin}"/>`,
  );
  parts.push(
    `<path d="M${cx - 14} 134 Q${cx} 146 ${cx + 14} 134" stroke="${shade}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  );
  parts.push(
    `<ellipse cx="${cx - 18}" cy="${eyeY}" rx="5" ry="6.5" fill="${C.ink}"/><ellipse cx="${cx + 18}" cy="${eyeY}" rx="5" ry="6.5" fill="${C.ink}"/>`,
  );
  parts.push(
    `<circle cx="${cx - 16.5}" cy="${eyeY - 2}" r="1.7" fill="${C.white}"/><circle cx="${cx + 19.5}" cy="${eyeY - 2}" r="1.7" fill="${C.white}"/>`,
  );
  const brow = p.sex === "m" ? 4.5 : 3;
  parts.push(
    `<path d="M${cx - 27} ${eyeY - 13} Q${cx - 18} ${eyeY - 18} ${cx - 9} ${eyeY - 13}" stroke="${HAIR}" stroke-width="${brow}" fill="none" stroke-linecap="round"/>`,
  );
  parts.push(
    `<path d="M${cx + 9} ${eyeY - 13} Q${cx + 18} ${eyeY - 18} ${cx + 27} ${eyeY - 13}" stroke="${HAIR}" stroke-width="${brow}" fill="none" stroke-linecap="round"/>`,
  );
  const lip = p.sex === "f" ? "#8A2E3B" : shade;
  parts.push(
    `<path d="M${cx - 17} 156 Q${cx} 172 ${cx + 17} 156" stroke="${lip}" stroke-width="${p.sex === "f" ? 5 : 4}" fill="none" stroke-linecap="round"/>`,
  );
  if (p.glasses) {
    parts.push(
      `<circle cx="${cx - 18}" cy="${eyeY}" r="14" fill="none" stroke="${C.ink}" stroke-width="3.5"/><circle cx="${cx + 18}" cy="${eyeY}" r="14" fill="none" stroke="${C.ink}" stroke-width="3.5"/>` +
        `<path d="M${cx - 4} ${eyeY} H${cx + 4}" stroke="${C.ink}" stroke-width="3.5"/>`,
    );
  }
  return parts.join("");
}

function svgFor(p) {
  const skin = SKIN[p.skin];
  const shade = SKIN_SHADE[p.skin];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><clipPath id="c"><circle cx="128" cy="128" r="128"/></clipPath></defs>
<g clip-path="url(#c)">
<rect width="256" height="256" fill="${p.bg}"/>
<circle cx="40" cy="48" r="26" fill="${C.white}" opacity="0.55"/>
${hairBack(p)}
${clothing(p, skin)}
${face(p, skin, shade)}
${hairFront(p)}
</g></svg>`;
}

const manifestFile = path.join(root, "design", "assets.manifest.json");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const now = new Date().toISOString();

for (let i = 0; i < PEOPLE.length; i++) {
  const p = PEOPLE[i];
  const id = `avatar-${String(i + 1).padStart(2, "0")}`;
  const svg = svgFor(p);
  writeFileSync(path.join(masters, `${id}.svg`), svg);
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(shipped, `${id}.png`));
  const entry = {
    id,
    placement: `Illustrated avatar for ${p.name}, used on the landing page, public pages and as the default profile picture`,
    master: `design/masters/avatars/${id}.svg`,
    sizes: [{ width: 256, height: 256, file: `avatars/${id}.png` }],
    alt: `Illustrated portrait of ${p.name}`,
    decorative: false,
    prompt:
      "Drawn in code by scripts/graphics/avatars.mjs: flat vector portrait, brand palette, no text.",
    status: "DRAFT",
    createdAt: now,
  };
  const at = manifest.assets.findIndex((a) => a.id === id);
  if (at === -1) manifest.assets.push(entry);
  else manifest.assets[at] = { ...entry, createdAt: manifest.assets[at].createdAt };
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
process.stdout.write(`Wrote ${PEOPLE.length} avatars.\n`);
