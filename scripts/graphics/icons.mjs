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
  football: `<circle cx="48" cy="50" r="30" fill="${W}" ${stroke(K, 4)}/><polygon points="48,38 59,46 55,59 41,59 37,46" fill="${K}"/><path d="M48 38 V24 M59 46 L71 40 M55 59 L64 71 M41 59 L32 71 M37 46 L25 40" ${stroke(K, 3)}/>`,
  "music-and-gbedu": `<path d="M42 68 V30 L68 24 V60" ${stroke(G, 6)}/><ellipse cx="35" cy="68" rx="9" ry="7" fill="${G}"/><ellipse cx="61" cy="60" rx="9" ry="7" fill="${G}"/><path d="M42 40 L68 34" ${stroke(Y, 4)}/>`,
  "politics-and-governance": `<path d="M20 38 L48 22 L76 38 Z" fill="${G}"/><rect x="26" y="42" width="9" height="26" fill="${W}" ${stroke(K, 3)}/><rect x="44" y="42" width="9" height="26" fill="${W}" ${stroke(K, 3)}/><rect x="62" y="42" width="9" height="26" fill="${W}" ${stroke(K, 3)}/><rect x="18" y="70" width="60" height="7" rx="2" fill="${Y}"/>`,
  "tech-and-startups": `<path d="M48 14 C60 24 62 44 56 58 L40 58 C34 44 36 24 48 14 Z" fill="${G}"/><circle cx="48" cy="38" r="6" fill="${W}" ${stroke(K, 3)}/><path d="M40 56 L30 68 L42 64 Z M56 56 L66 68 L54 64 Z" fill="${GD}"/><path d="M44 60 C44 70 46 76 48 80 C50 76 52 70 52 60 Z" fill="${Y}"/>`,
  "business-and-money": `<rect x="14" y="52" width="11" height="26" rx="3" fill="${G}"/><rect x="30" y="40" width="11" height="38" rx="3" fill="${GD}"/><rect x="46" y="30" width="11" height="48" rx="3" fill="${G}"/><path d="M16 44 L34 32 L50 36 L72 22" ${stroke(K, 4)}/><path d="M62 20 H74 V32" ${stroke(K, 4)}/><circle cx="72" cy="64" r="14" fill="${Y}" ${stroke(K, 3.5)}/><path d="M67 57 V71 M77 57 V71" ${stroke(K, 2.5)}/><path d="M64 61 H80 M64 66 H80" ${stroke(K, 2.5)}/>`,
  relationships: `<path d="M36 30 C30 20 14 24 14 38 C14 50 28 58 36 66 C44 58 58 50 58 38 C58 24 42 20 36 30 Z" fill="${G}"/><path d="M66 44 C62 37 50 40 50 50 C50 59 60 64 66 70 C72 64 82 59 82 50 C82 40 70 37 66 44 Z" fill="${Y}" ${stroke(K, 3)}/>`,
  "faith-and-life": `<path d="M48 40 C44 32 30 35 30 46 C30 56 41 62 48 70 C55 62 66 56 66 46 C66 35 52 32 48 40 Z" fill="${Y}"/><path d="M48 14 V24 M30 20 L36 27 M66 20 L60 27 M20 42 H27 M69 42 H76" ${stroke(G, 4)}/>`,
  "campus-life": `<polygon points="48,26 14,42 48,58 82,42" fill="${K}"/><path d="M32 48 V60 C32 68 64 68 64 60 V48 L48 57 Z" fill="${G}"/><path d="M78 44 V62" ${stroke(Y, 4)}/><circle cx="78" cy="66" r="4" fill="${Y}"/>`,
  "nollywood-and-entertainment": `<rect x="18" y="42" width="60" height="34" rx="6" fill="${G}" ${stroke(K, 3.5)}/><path d="M20 36 L76 28 L78 40 L22 48 Z" fill="${Y}" ${stroke(K, 3.5)}/><path d="M32 34 L38 45 M50 31 L56 42 M68 28 L74 39" ${stroke(K, 3)}/><path d="M42 54 L60 60 L42 68 Z" fill="${W}"/>`,
  "food-and-chop": `<path d="M18 54 H78 C78 68 64 78 48 78 C32 78 18 68 18 54 Z" fill="${G}"/><ellipse cx="48" cy="54" rx="30" ry="6" fill="${GT}" ${stroke(K, 3)}/><path d="M36 46 C36 40 42 40 42 34 M52 46 C52 40 58 40 58 34 M68 46 C68 42 71 40 71 36" ${stroke(K, 3.5)}/>`,
  "health-and-wellness": `<path d="M48 72 C34 60 22 50 22 38 C22 27 37 25 44 33 C46 36 48 38 48 38 C48 38 50 36 52 33 C59 25 74 27 74 38 C74 50 62 60 48 72 Z" fill="${W}" ${stroke(G, 4)}/><path d="M28 48 H38 L44 38 L52 58 L58 48 H68" ${stroke(K, 4)}/>`,
  "careers-and-jobs": `<rect x="14" y="34" width="68" height="42" rx="7" fill="${G}" ${stroke(K, 3.5)}/><path d="M38 34 V28 C38 21 58 21 58 28 V34" ${stroke(K, 4)}/><path d="M14 52 H82" ${stroke(K, 3.5)}/><rect x="42" y="48" width="12" height="9" rx="2" fill="${Y}"/>`,
  education: `<path d="M14 30 C26 24 40 24 48 30 C56 24 70 24 82 30 V68 C70 62 56 62 48 68 C40 62 26 62 14 68 Z" fill="${W}" ${stroke(G, 4)}/><path d="M48 30 V68" ${stroke(G, 3.5)}/><path d="M24 38 H40 M24 46 H40 M56 38 H72 M56 46 H72" ${stroke(Y, 3.5)}/>`,
  comedy: `<circle cx="48" cy="48" r="30" fill="${Y}" ${stroke(K, 3.5)}/><path d="M31 40 C33 35 40 35 42 40 M54 40 C56 35 63 35 65 40" ${stroke(K, 4)}/><path d="M32 52 C36 65 60 65 64 52 Z" fill="${K}"/><path d="M39 60 C44 62 52 62 57 60" ${stroke(W, 3)}/>`,
  "diaspora-and-japa": `<path d="M14 46 L84 20 L58 82 L48 58 Z" fill="${G}" ${stroke(K, 3.5)}/><path d="M48 58 L84 20" ${stroke(K, 3)}/><path d="M16 64 L30 59 M12 76 L32 67" ${stroke(Y, 4)}/>`,
  "fashion-and-owambe": `<path d="M36 22 L48 30 L60 22 L78 34 L68 48 L64 42 V76 H32 V42 L28 48 L18 34 Z" fill="${G}" ${stroke(K, 3.5)}/><path d="M40 23 C42 31 54 31 56 23" ${stroke(Y, 4)}/>`,
  gaming: `<path d="M24 34 H72 C82 34 88 44 88 54 C88 66 80 74 72 70 L62 62 H34 L24 70 C16 74 8 66 8 54 C8 44 14 34 24 34 Z" fill="${K}"/><path d="M30 44 V56 M24 50 H36" ${stroke(W, 4)}/><circle cx="62" cy="46" r="4" fill="${Y}"/><circle cx="70" cy="54" r="4" fill="${G}"/>`,
  "open-gist": `${bubble(12, 18, 56, 40, G, "left")}<rect x="34" y="28" width="12" height="20" rx="6" fill="${Y}"/><path d="M28 44 C28 54 52 54 52 44" ${stroke(W, 3)}/>${bubble(48, 50, 36, 26, Y, "right")}<path d="M56 62 H74 M56 68 H68" ${stroke(K, 3)}/>`,
  "device-android": `<path d="M36 24 L30 14 M60 24 L66 14" ${stroke(G, 4)}/><path d="M28 44 C28 32 68 32 68 44 V56 C68 64 62 70 54 70 H42 C34 70 28 64 28 56 Z" fill="${G}"/><circle cx="40" cy="44" r="3.5" fill="${W}"/><circle cx="56" cy="44" r="3.5" fill="${W}"/><path d="M20 46 V58 M76 46 V58" ${stroke(G, 5)}/><path d="M38 74 V82 M58 74 V82" ${stroke(K, 4)}/>`,
  "device-ios": `<rect x="30" y="12" width="36" height="72" rx="9" fill="${W}" ${stroke(K, 4)}/><path d="M42 19 H54" ${stroke(K, 3.5)}/><rect x="36" y="26" width="24" height="42" rx="4" fill="${GT}"/><path d="M48 58 V38 M41 45 L48 38 L55 45" ${stroke(G, 4)}/><path d="M40 63 H56" ${stroke(G, 3.5)}/>`,
  "device-desktop": `<rect x="14" y="18" width="68" height="46" rx="6" fill="${W}" ${stroke(K, 4)}/><rect x="20" y="24" width="56" height="30" rx="3" fill="${GT}"/><path d="M48 28 V46 M40 40 L48 48 L56 40" ${stroke(G, 4)}/><path d="M42 64 V72 M54 64 V72" ${stroke(K, 4)}/><path d="M32 76 H64" ${stroke(K, 4)}/>`,
  alerts: `<path d="M48 20 C36 20 30 30 30 42 V54 L22 64 H74 L66 54 V42 C66 30 60 20 48 20 Z" fill="${G}"/><path d="M43 70 C43 76 53 76 53 70" ${stroke(K, 4)}/><circle cx="48" cy="15" r="3" fill="${Y}"/><path d="M20 34 C16 38 14 43 14 48 M76 34 C80 38 82 43 82 48" ${stroke(Y, 3.5)}/>`,
  speed: `<path d="M54 12 L28 52 H46 L42 84 L70 40 H50 Z" fill="${Y}" ${stroke(K, 3.5)}/>`,
  idea: `<path d="M48 14 C34 14 25 24 25 37 C25 47 31 54 37 59 V65 H59 V59 C65 54 71 47 71 37 C71 24 62 14 48 14 Z" fill="${Y}" ${stroke(K, 3.5)}/><path d="M42 71 H54 M45 78 H51" ${stroke(K, 4)}/><path d="M48 30 V44 M40 38 L48 44 L56 38" ${stroke(G, 4)}/>`,
  honest: `${bubble(16, 22, 64, 44, G, "left")}<path d="M34 44 L45 54 L64 34" ${stroke(Y, 5)}/>`,
  "mascot-install": `<rect x="16" y="34" width="7" height="34" rx="3" fill="${K}"/><rect x="14" y="60" width="32" height="7" rx="3.5" fill="${K}"/><path d="M20 67 V82 M40 67 V82" ${stroke(K, 4)}/><circle cx="36" cy="26" r="8" fill="#8C5B3A"/><path d="M28 25 C28 16 44 16 44 26 C41 21 31 21 28 25 Z" fill="${K}"/><path d="M26 62 L26 46 C26 38 32 34 38 34 C46 34 48 40 48 46 L48 54 L54 54 L54 62 Z" fill="${G}"/><path d="M28 62 H50 L54 80 H46 L42 68 H28 Z" fill="${GD}"/><path d="M46 42 L58 50" ${stroke("#8C5B3A", 4.5)}/><rect x="58" y="34" width="32" height="24" rx="3" fill="${GD}"/><rect x="66" y="40" width="16" height="14" rx="4" fill="${K}"/><path d="M71 50 V46" ${stroke(G, 2)}/><path d="M74 51 V44" ${stroke(Y, 2)}/><path d="M77 50 V46" ${stroke(G, 2)}/><path d="M54 58 H92 L88 62 H58 Z" fill="${K}"/>`,
  tools: `<circle cx="48" cy="48" r="32" fill="${W}" ${stroke(K, 4)}/><circle cx="48" cy="48" r="14" fill="${W}" ${stroke(K, 3)}/><path d="M48 16 V34 M48 62 V80 M16 48 H34 M62 48 H80" ${stroke(G, 9)}/><circle cx="48" cy="48" r="4" fill="${Y}"/>`,
  "mascot-gist": `<path d="M36 24 C36 14 52 14 52 25 C49 20 39 20 36 24 Z" fill="${K}"/><circle cx="44" cy="30" r="9" fill="#8C5B3A"/><path d="M28 84 L28 60 C28 48 35 42 44 42 C53 42 60 48 60 60 L60 84 Z" fill="${G}"/><path d="M56 54 C62 48 66 42 68 34" ${stroke("#8C5B3A", 5)}/><circle cx="69" cy="31" r="5" fill="#8C5B3A"/>${bubble(56, 8, 32, 22, Y, "right")}<path d="M66 23 V18 M72 25 V16 M78 23 V18" ${stroke(K, 2.5)}/>`,
  account: `<rect x="14" y="22" width="68" height="52" rx="7" fill="${W}" ${stroke(G, 4)}/><circle cx="34" cy="40" r="8" fill="${G}"/><path d="M22 58 C22 48 46 48 46 58 Z" fill="${G}"/><path d="M56 36 H74 M56 44 H70 M56 52 H66" ${stroke(K, 3.5)}/>${padlock(72, 66, Y)}`,
  devices: `<rect x="10" y="22" width="54" height="38" rx="5" fill="${W}" ${stroke(K, 4)}/><rect x="16" y="28" width="42" height="24" rx="2" fill="${GT}"/><path d="M30 60 V68 M44 60 V68 M24 70 H50" ${stroke(K, 4)}/><rect x="58" y="40" width="28" height="44" rx="6" fill="${G}" ${stroke(K, 3.5)}/><rect x="63" y="47" width="18" height="26" rx="2" fill="${W}"/><circle cx="72" cy="79" r="2.5" fill="${W}"/>`,
  moderator: `${person(38, 30, "#76492F", G)}${shield(68, 58, 20, Y)}<path d="M62 57 l4 4 l8 -8" ${stroke(K, 3.5)}/>`,
  switch: `<path d="M18 38 H68" ${stroke(G, 8)}/><path d="M56 26 L70 38 L56 50" ${stroke(G, 8)}/><path d="M78 60 H28" ${stroke(K, 8)}/><path d="M40 48 L26 60 L40 72" ${stroke(K, 8)}/>`,
  discover: `<circle cx="48" cy="48" r="30" fill="${W}" ${stroke(G, 5)}/><path d="M60 36 L52 52 L36 60 L44 44 Z" fill="${Y}" ${stroke(K, 3.5)}/><circle cx="48" cy="48" r="3.5" fill="${K}"/><path d="M48 14 V20 M48 76 V82 M14 48 H20 M76 48 H82" ${stroke(G, 4)}/>`,
  "rooms-for-you": `<rect x="12" y="24" width="72" height="48" rx="10" fill="${W}" ${stroke(G, 4)}/><circle cx="34" cy="48" r="9" fill="${G}"/><circle cx="34" cy="48" r="15" ${stroke(Y, 3.5)}/><circle cx="62" cy="40" r="6" fill="${GD}"/><circle cx="62" cy="58" r="6" fill="${Y}"/><path d="M52 40 H48 M52 58 H48" ${stroke(G, 3)}/>${star(76, 20, 9, Y)}`,
  "people-like-you": `${person(32, 36, "#8C5B3A", G)}${person(62, 36, "#5E3825", GD)}<path d="M48 70 C44 62 34 64 34 72 C34 78 42 82 48 88 C54 82 62 78 62 72 C62 64 52 62 48 70 Z" fill="${Y}" ${stroke(K, 3)}/>`,
  interests: `<path d="M10 40 L40 12 H70 V42 L40 70 Z" fill="${G}" ${stroke(K, 3.5)}/><circle cx="58" cy="26" r="5" fill="${W}"/><path d="M28 44 H44 M36 36 V52" ${stroke(Y, 4.5)}/>${star(72, 66, 12, Y)}<path d="M18 70 H40" ${stroke(G, 4)}/>`,
  notes: `<rect x="20" y="14" width="44" height="62" rx="6" fill="${YT}" ${stroke(K, 3.5)}/><path d="M28 30 H56 M28 40 H56 M28 50 H46" ${stroke(G, 3.5)}/><path d="M60 52 L80 32 L88 40 L68 60 L58 62 Z" fill="${Y}" ${stroke(K, 3.5)}/><path d="M74 38 L82 46" ${stroke(K, 3)}/>`,
  search: `<circle cx="42" cy="42" r="24" fill="${W}" ${stroke(G, 6)}/><path d="M60 60 L80 80" ${stroke(K, 7)}/>${star(66, 24, 10, Y)}<path d="M30 40 C32 34 38 32 42 33" ${stroke(G, 3.5)}/>`,
  "welcome-back": `<path d="M22 46 L48 22 L74 46 V76 H22 Z" fill="${G}" ${stroke(K, 3.5)}/><rect x="40" y="52" width="16" height="24" rx="3" fill="${Y}"/><circle cx="52" cy="64" r="1.8" fill="${K}"/><path d="M16 48 L48 18 L80 48" ${stroke(K, 4.5)}/><path d="M72 18 C76 14 82 16 82 22 M78 12 C84 8 90 12 90 18" ${stroke(Y, 3.5)}/>`,
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
