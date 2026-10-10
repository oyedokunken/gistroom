import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const bannedPhrases = JSON.parse(
  readFileSync(path.join(here, "..", "banned-phrases.json"), "utf8"),
);

// Dashes (R2): U+2012, U+2013, U+2014, U+2015. Emoji joiners and flags (R1).
const DASHES = new RegExp(
  `[${[0x2012, 0x2013, 0x2014, 0x2015].map((c) => String.fromCodePoint(c)).join("")}]`,
  "u",
);
const EMOJI_PARTS = new RegExp(
  `[${[0xfe0f, 0x200d, 0x20e3].map((c) => String.fromCodePoint(c)).join("")}${String.fromCodePoint(0x1f1e6)}-${String.fromCodePoint(0x1f1ff)}]`,
  "u",
);
const PICTO = /\p{Extended_Pictographic}/u;
const ALLOWED_PICTO = new Set([0xa9, 0xae, 0x2122].map((c) => String.fromCodePoint(c)));

function charName(ch) {
  const cp = ch.codePointAt(0);
  const names = {
    0x2012: "FIGURE DASH",
    0x2013: "EN DASH",
    0x2014: "EM DASH",
    0x2015: "HORIZONTAL BAR",
    0xfe0f: "VARIATION SELECTOR-16",
    0x200d: "ZERO WIDTH JOINER",
    0x20e3: "COMBINING ENCLOSING KEYCAP",
  };
  return names[cp] ?? `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** Returns a list of { line, column, message } problems for a block of text. */
export function checkText(text) {
  const problems = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    let col = 0;
    for (const ch of line) {
      col += 1;
      if (DASHES.test(ch) || EMOJI_PARTS.test(ch) || (PICTO.test(ch) && !ALLOWED_PICTO.has(ch))) {
        problems.push({ line: i + 1, column: col, message: `forbidden character ${charName(ch)}` });
      }
    }
    const lower = line.toLowerCase();
    for (const phrase of bannedPhrases) {
      const idx = lower.indexOf(phrase);
      if (idx === -1) continue;
      const before = idx === 0 ? " " : (lower[idx - 1] ?? " ");
      const after = lower[idx + phrase.length] ?? " ";
      if (/[a-z]/.test(before) || (/[a-z]/.test(after) && phrase !== "leverage")) continue;
      problems.push({ line: i + 1, column: idx + 1, message: `banned phrase "${phrase}"` });
    }
  });
  return problems;
}

export function stripCoAuthor(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => !/^co-authored-by:/i.test(l.trim()))
    .join("\n");
}
