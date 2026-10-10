// A tiny toolkit for drawing flat Nigerian street and gist scenes as SVG strings.
// Scenes are functions of t (0 to 1, one loop) so the same drawing gives a still frame and an animation.

export const C = {
  green: "#0E7A43",
  greenDark: "#0A5C32",
  greenTint: "#E4F4EB",
  yellow: "#FFC20E",
  yellowTint: "#FFF4CC",
  ink: "#0B0B0C",
  ink700: "#3A3A3F",
  ink500: "#6B6B72",
  ink200: "#E3E3E6",
  white: "#FFFFFF",
  red: "#C62828",
  clay: "#B5532B",
  night: "#14201A",
};
export const SKIN = ["#4A2C1D", "#5E3825", "#76492F", "#8C5B3A", "#A47049", "#BE8A62"];

const tau = Math.PI * 2;
export const wave = (t, phase = 0, speed = 1) => Math.sin((t * speed + phase) * tau);
export const pulse = (t, phase = 0, speed = 1) => (wave(t, phase, speed) + 1) / 2;

/**
 * A faceless flat person standing with feet on base.
 * opts: skin, shirt, pants, hair (afro|low|wrap|hijab|fila|cap|none), headwear colour, arm (up|phone|cup|none), size
 */
export function person(x, base, opts = {}) {
  const {
    skin = SKIN[2],
    shirt = C.green,
    pants = C.ink700,
    hair = "low",
    cap = C.yellow,
    arm = "none",
    armWave = 0,
    size = 1,
    sway = 0,
    sit = false,
  } = opts;
  const s = size;
  const headR = 15 * s;
  const bodyW = 34 * s;
  const bodyH = (sit ? 46 : 62) * s;
  const legH = (sit ? 18 : 44) * s;
  const topY = base - legH - bodyH;
  const headY = topY - headR + 2 * s;
  const lean = sway;
  let g = `<g transform="translate(${x + lean} 0)">`;
  // Legs
  if (sit) {
    g += `<rect x="${-bodyW / 2}" y="${base - legH}" width="${bodyW}" height="${legH * 0.55}" rx="${5 * s}" fill="${pants}"/>`;
    g += `<rect x="${bodyW / 2 - 6 * s}" y="${base - legH}" width="${34 * s}" height="${12 * s}" rx="${5 * s}" fill="${pants}"/>`;
    g += `<rect x="${bodyW / 2 + 22 * s}" y="${base - legH}" width="${12 * s}" height="${legH}" rx="${4 * s}" fill="${pants}"/>`;
  } else {
    g += `<rect x="${-bodyW / 2 + 2 * s}" y="${base - legH}" width="${13 * s}" height="${legH}" rx="${4 * s}" fill="${pants}"/>`;
    g += `<rect x="${bodyW / 2 - 15 * s}" y="${base - legH}" width="${13 * s}" height="${legH}" rx="${4 * s}" fill="${pants}"/>`;
  }
  // Body and arms
  g += `<rect x="${-bodyW / 2}" y="${topY}" width="${bodyW}" height="${bodyH}" rx="${12 * s}" fill="${shirt}"/>`;
  g += `<rect x="${-bodyW / 2 - 7 * s}" y="${topY + 6 * s}" width="${11 * s}" height="${bodyH * 0.7}" rx="${5 * s}" fill="${shirt}"/>`;
  if (arm === "up") {
    g +=
      `<g transform="rotate(${14 + armWave} ${bodyW / 2} ${topY})">` +
      `<rect x="${bodyW / 2 - 4 * s}" y="${topY - 28 * s}" width="${11 * s}" height="${50 * s}" rx="${5 * s}" fill="${shirt}"/>` +
      `<circle cx="${bodyW / 2 + 8 * s}" cy="${topY - 30 * s}" r="${6 * s}" fill="${skin}"/>` +
      "</g>";
  } else if (arm === "phone" || arm === "cup") {
    g += `<rect x="${bodyW / 2 - 6 * s}" y="${topY + 8 * s}" width="${11 * s}" height="${30 * s}" rx="${5 * s}" fill="${shirt}" transform="rotate(-30 ${bodyW / 2} ${topY + 8 * s})"/>`;
    g +=
      arm === "phone"
        ? `<rect x="${bodyW / 2 + 6 * s}" y="${topY + 2 * s}" width="${9 * s}" height="${15 * s}" rx="${2 * s}" fill="${C.ink}"/>`
        : `<rect x="${bodyW / 2 + 6 * s}" y="${topY + 4 * s}" width="${9 * s}" height="${12 * s}" rx="${2 * s}" fill="${C.yellowTint}"/>`;
  } else {
    g += `<rect x="${bodyW / 2 - 4 * s}" y="${topY + 6 * s}" width="${11 * s}" height="${bodyH * 0.7}" rx="${5 * s}" fill="${shirt}"/>`;
  }
  // Neck and head
  g += `<rect x="${-5 * s}" y="${topY - 6 * s}" width="${10 * s}" height="${10 * s}" fill="${skin}"/>`;
  g += `<circle cx="0" cy="${headY}" r="${headR}" fill="${skin}"/>`;
  const hy = headY;
  const hair_ = "#1A1210";
  switch (hair) {
    case "afro":
      g += `<circle cx="0" cy="${hy - 5 * s}" r="${headR + 7 * s}" fill="${hair_}"/><circle cx="0" cy="${hy + 2 * s}" r="${headR}" fill="${skin}"/>`;
      break;
    case "low":
      g += `<path d="M${-headR} ${hy} A${headR} ${headR} 0 0 1 ${headR} ${hy} Q0 ${hy - 9 * s} ${-headR} ${hy} Z" fill="${hair_}"/>`;
      break;
    case "wrap":
      g += `<path d="M${-headR - 3 * s} ${hy + 2 * s} Q0 ${hy - 28 * s} ${headR + 3 * s} ${hy + 2 * s} L${headR + 8 * s} ${hy - 14 * s} L${headR - 2 * s} ${hy - 10 * s} Z" fill="${cap}"/><path d="M${-headR} ${hy - 6 * s} Q0 ${hy - 16 * s} ${headR} ${hy - 6 * s}" stroke="${C.greenDark}" stroke-width="${2.5 * s}" fill="none"/>`;
      break;
    case "hijab":
      g += `<path d="M${-headR - 5 * s} ${hy + 18 * s} Q${-headR - 8 * s} ${hy - 20 * s} 0 ${hy - 20 * s} Q${headR + 8 * s} ${hy - 20 * s} ${headR + 5 * s} ${hy + 18 * s} Q0 ${hy + 28 * s} ${-headR - 5 * s} ${hy + 18 * s} Z" fill="${cap}"/><ellipse cx="0" cy="${hy + 2 * s}" rx="${headR - 3 * s}" ry="${headR - 1 * s}" fill="${skin}"/>`;
      break;
    case "fila":
      g += `<path d="M${-headR - 2 * s} ${hy - 2 * s} Q0 ${hy - 26 * s} ${headR + 2 * s} ${hy - 2 * s} Z" fill="${cap}"/><rect x="${-headR - 3 * s}" y="${hy - 5 * s}" width="${2 * headR + 6 * s}" height="${5 * s}" rx="${2 * s}" fill="${C.yellow}"/>`;
      break;
    case "cap":
      g += `<path d="M${-headR} ${hy - 3 * s} Q0 ${hy - 22 * s} ${headR} ${hy - 3 * s} Z" fill="${cap}"/><rect x="${headR - 4 * s}" y="${hy - 5 * s}" width="${14 * s}" height="${4 * s}" rx="${2 * s}" fill="${cap}"/>`;
      break;
    default:
      break;
  }
  g += `</g>`;
  return g;
}

export const rect = (x, y, w, h, fill, rx = 0, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
export const circle = (cx, cy, r, fill, extra = "") =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
export const poly = (pts, fill) =>
  `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${fill}"/>`;

/** Concentric speaking rings around a point. */
export function rings(cx, cy, r, t, color = C.green, phase = 0) {
  return [0, 0.5]
    .map((o) => {
      const k = (t + phase + o) % 1;
      return `<circle cx="${cx}" cy="${cy}" r="${r + k * 26}" fill="none" stroke="${color}" stroke-width="4" opacity="${(1 - k) * 0.7}"/>`;
    })
    .join("");
}

/** A row of sound bars that bounce. */
export function soundBars(x, y, count, t, color = C.yellow, w = 10, maxH = 60) {
  return Array.from({ length: count }, (_, i) => {
    const h = 14 + pulse(t, i * 0.13, 1) * (maxH - 14) * (0.5 + 0.5 * pulse(0, i * 0.37));
    return rect(x + i * (w + 6), y - h, w, h, color, w / 2);
  }).join("");
}

/** A danfo: yellow body, black stripe, rows of windows. */
export function danfo(x, base, s = 1, t = 0) {
  const w = 300 * s;
  const h = 130 * s;
  const y = base - h - 24 * s;
  let g = rect(x, y, w, h, C.yellow, 16 * s);
  g += rect(x, y + h * 0.52, w, 14 * s, C.ink, 0);
  for (let i = 0; i < 5; i++)
    g += rect(x + 16 * s + i * 54 * s, y + 14 * s, 44 * s, 34 * s, C.greenTint, 5 * s);
  g += rect(x + w - 8 * s, y + 20 * s, 14 * s, 26 * s, C.yellowTint, 4 * s);
  g +=
    circle(x + 62 * s, base - 14 * s, 24 * s, C.ink) +
    circle(x + 62 * s, base - 14 * s, 9 * s, C.ink200);
  g +=
    circle(x + w - 62 * s, base - 14 * s, 24 * s, C.ink) +
    circle(x + w - 62 * s, base - 14 * s, 9 * s, C.ink200);
  // the conductor hanging out of the door, waving
  g += person(x + w - 26 * s, y + h + 2 * s, {
    size: 0.62 * s,
    shirt: C.white,
    skin: SKIN[1],
    arm: "up",
    armWave: wave(t, 0, 6) * 18,
    sway: wave(t, 0, 2) * 2,
  });
  return g;
}

export function keke(x, base, s = 1) {
  const w = 190 * s;
  let g = `<path d="M${x} ${base - 24 * s} L${x + 30 * s} ${base - 110 * s} H${x + w - 30 * s} L${x + w} ${base - 24 * s} Z" fill="${C.yellow}"/>`;
  g += rect(x + 24 * s, base - 128 * s, w - 48 * s, 20 * s, C.green, 10 * s);
  g +=
    rect(x + 40 * s, base - 98 * s, 54 * s, 40 * s, C.greenTint, 5 * s) +
    rect(x + 100 * s, base - 98 * s, 48 * s, 40 * s, C.greenTint, 5 * s);
  g += rect(x, base - 36 * s, w, 16 * s, C.ink, 6 * s);
  g +=
    circle(x + 40 * s, base - 14 * s, 20 * s, C.ink) +
    circle(x + 40 * s, base - 14 * s, 7 * s, C.ink200);
  g +=
    circle(x + w - 36 * s, base - 14 * s, 20 * s, C.ink) +
    circle(x + w - 36 * s, base - 14 * s, 7 * s, C.ink200);
  return g;
}

export function building(x, base, w, h, fill, windows = true, lit = C.yellowTint) {
  let g = rect(x, base - h, w, h, fill);
  if (windows) {
    for (let r = 0; r < Math.floor(h / 46) - 1; r++)
      for (let c = 0; c < Math.floor(w / 36); c++)
        g += rect(
          x + 10 + c * 36,
          base - h + 18 + r * 46,
          18,
          24,
          (r + c) % 3 === 0 ? lit : C.greenTint,
          3,
          `opacity="0.85"`,
        );
  }
  return g;
}

export function lantern(x, y, t) {
  const glow = 0.3 + pulse(t, 0.2, 2) * 0.25;
  return (
    circle(x, y, 60, C.yellow, `opacity="${glow}"`) +
    rect(x - 8, y - 14, 16, 28, C.yellow, 4) +
    rect(x - 10, y - 18, 20, 5, C.ink, 2) +
    rect(x - 10, y + 13, 20, 5, C.ink, 2)
  );
}

export function plant(x, base, s = 1) {
  return (
    rect(x - 16 * s, base - 34 * s, 32 * s, 34 * s, C.clay, 4 * s) +
    `<path d="M${x} ${base - 34 * s} C${x - 40 * s} ${base - 70 * s} ${x - 30 * s} ${base - 100 * s} ${x - 6 * s} ${base - 110 * s} C${x - 4 * s} ${base - 80 * s} ${x - 6 * s} ${base - 60 * s} ${x} ${base - 34 * s} Z" fill="${C.green}"/><path d="M${x} ${base - 34 * s} C${x + 40 * s} ${base - 64 * s} ${x + 36 * s} ${base - 96 * s} ${x + 10 * s} ${base - 104 * s} C${x + 8 * s} ${base - 78 * s} ${x + 6 * s} ${base - 58 * s} ${x} ${base - 34 * s} Z" fill="${C.greenDark}"/>`
  );
}

/** A football that bounces along a ground line. */
export function ball(x, ground, t, r = 14) {
  const lift = Math.abs(wave(t, 0, 1)) * 90;
  return (
    circle(x, ground - r - lift, r, C.white) +
    `<path d="M${x - 5} ${ground - r - lift - 3} l5 -5 l5 5 l-3 6 h-4 Z" fill="${C.ink}"/>`
  );
}

/** Adire style bunting across the top of a scene. */
export function bunting(x1, y, x2, sag = 26) {
  const n = 9;
  let g = `<path d="M${x1} ${y} Q${(x1 + x2) / 2} ${y + sag} ${x2} ${y}" stroke="${C.ink700}" stroke-width="3" fill="none"/>`;
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const x = x1 + (x2 - x1) * k;
    const yy = y + sag * 2 * k * (1 - k);
    g += poly(
      [
        [x - 12, yy],
        [x + 12, yy],
        [x, yy + 26],
      ],
      [C.green, C.yellow, C.greenDark, C.yellowTint][i % 4],
    );
  }
  return g;
}

export const wrap = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
