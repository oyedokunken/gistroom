/** Where the call window sits and how big it is. Pure, so dragging and resizing are tested without a browser. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Viewport {
  w: number;
  h: number;
}
export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const WINDOW = {
  minW: 320,
  minH: 240,
  /** The most of the screen it may take, so the page behind stays in reach. */
  maxFrac: 0.8,
  /** The gap kept to every screen edge. */
  margin: 8,
  /** Where it starts: top right, below the page header. */
  topOffset: 72,
  rightOffset: 16,
  defaultW: 480,
  defaultH: 380,
  /** How close to an edge a drop snaps to it. */
  snap: 24,
  /** The height of the header bar, which the video area sits below. */
  headerH: 44,
  /** Phones and narrow windows use the whole screen instead. */
  phoneMaxW: 767,
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/** Keeps size within the minimum and 80 percent of the viewport, and the window fully on screen. */
export function clampRect(r: Rect, vp: Viewport): Rect {
  const w = Math.round(clamp(r.w, WINDOW.minW, vp.w * WINDOW.maxFrac));
  const h = Math.round(clamp(r.h, WINDOW.minH, vp.h * WINDOW.maxFrac));
  const x = Math.round(clamp(r.x, WINDOW.margin, vp.w - w - WINDOW.margin));
  const y = Math.round(clamp(r.y, WINDOW.margin, vp.h - h - WINDOW.margin));
  return { x, y, w, h };
}

/** Top right, below the header, in the usual size. */
export function defaultRect(vp: Viewport): Rect {
  return clampRect(
    {
      x: vp.w - WINDOW.defaultW - WINDOW.rightOffset,
      y: WINDOW.topOffset,
      w: WINDOW.defaultW,
      h: WINDOW.defaultH,
    },
    vp,
  );
}

/** After a drag ends, an edge that is within reach pulls the window to it. Both axes together make a corner. */
export function snapRect(r: Rect, vp: Viewport, threshold: number = WINDOW.snap): Rect {
  const m = WINDOW.margin;
  let { x, y } = r;
  if (Math.abs(x - m) <= threshold) x = m;
  else if (Math.abs(vp.w - (x + r.w) - m) <= threshold) x = vp.w - r.w - m;
  if (Math.abs(y - m) <= threshold) y = m;
  else if (Math.abs(vp.h - (y + r.h) - m) <= threshold) y = vp.h - r.h - m;
  return clampRect({ ...r, x, y }, vp);
}

/** Moves the window by a pointer drag and keeps it on screen. */
export function dragRect(start: Rect, dx: number, dy: number, vp: Viewport): Rect {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, vp);
}

/**
 * Resizes from an edge or a corner. The opposite side stays where it is. With `aspect` (width over height of the video
 * area) the height follows the width, so a call keeps a 16 by 9 picture.
 */
export function resizeRect(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  vp: Viewport,
  aspect?: number,
): Rect {
  let { x, y, w, h } = start;
  const maxW = vp.w * WINDOW.maxFrac;
  const maxH = vp.h * WINDOW.maxFrac;
  if (handle.includes("e")) w = clamp(start.w + dx, WINDOW.minW, maxW);
  if (handle.includes("s")) h = clamp(start.h + dy, WINDOW.minH, maxH);
  if (handle.includes("w")) {
    w = clamp(start.w - dx, WINDOW.minW, maxW);
    x = start.x + start.w - w;
  }
  if (handle.includes("n")) {
    h = clamp(start.h - dy, WINDOW.minH, maxH);
    y = start.y + start.h - h;
  }
  if (aspect && (handle.includes("e") || handle.includes("w"))) {
    h = clamp(w / aspect + WINDOW.headerH, WINDOW.minH, maxH);
    if (handle.includes("n")) y = start.y + start.h - h;
  }
  return clampRect({ x, y, w, h }, vp);
}

/** Phones and narrow screens do not float: the window fills the screen. */
export const isPhone = (vp: Viewport): boolean => vp.w <= WINDOW.phoneMaxW;

/** A rect read back from storage may be from another screen size. Anything that is not four numbers is dropped. */
export function parseRect(raw: unknown): Rect | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const nums = [o["x"], o["y"], o["w"], o["h"]];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { x: o["x"] as number, y: o["y"] as number, w: o["w"] as number, h: o["h"] as number };
}
