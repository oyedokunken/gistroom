import { describe, expect, it } from "vitest";
import {
  WINDOW,
  clampRect,
  defaultRect,
  dragRect,
  isPhone,
  parseRect,
  resizeRect,
  snapRect,
} from "../../apps/web/src/lib/call-window/geometry";
import {
  hasScreen,
  initialWindow,
  windowReducer,
  type WindowEvent,
  type WindowState,
} from "../../apps/web/src/lib/call-window/machine";

const call = { kind: "call" as const, id: "c1" };
const room = { kind: "room" as const, id: "abc" };
const run = (events: WindowEvent[], from: WindowState = initialWindow) =>
  events.reduce(windowReducer, from);

describe("call window state machine", () => {
  it("opens expanded, or full screen on a phone", () => {
    expect(run([{ type: "open", target: call }]).mode).toBe("EXPANDED");
    expect(run([{ type: "open", target: call, phone: true }]).mode).toBe("FULLSCREEN");
  });

  it("goes between expanded, minimized and full screen and back", () => {
    let s = run([{ type: "open", target: room }]);
    s = windowReducer(s, { type: "minimize" });
    expect(s.mode).toBe("MINIMIZED");
    s = windowReducer(s, { type: "restore" });
    expect(s.mode).toBe("EXPANDED");
    s = windowReducer(s, { type: "toggleFullscreen" });
    expect(s.mode).toBe("FULLSCREEN");
    s = windowReducer(s, { type: "exitFullscreen" });
    expect(s.mode).toBe("EXPANDED");
    // Minimizing from full screen returns to full screen, which is the phone's only size.
    s = run([{ type: "fullscreen" }, { type: "minimize" }, { type: "restore" }], s);
    expect(s.mode).toBe("FULLSCREEN");
  });

  it("keeps the call it shows when events that do not apply arrive", () => {
    const s = run([{ type: "open", target: call }]);
    expect(windowReducer(s, { type: "restore" })).toBe(s);
    expect(windowReducer(s, { type: "exitFullscreen" })).toBe(s);
    expect(windowReducer(s, { type: "dismissRing" })).toBe(s);
    expect(s.target).toEqual(call);
  });

  it("rings from hidden, never over a window that is showing, and clears on every way out", () => {
    const ringing = run([{ type: "ring", target: call }]);
    expect(ringing.mode).toBe("RINGING");
    expect(hasScreen(ringing)).toBe(false);
    // Declined, timed out, cancelled or answered elsewhere.
    expect(windowReducer(ringing, { type: "dismissRing" })).toEqual(initialWindow);
    // Answered: the ring becomes the window.
    expect(windowReducer(ringing, { type: "open", target: call }).mode).toBe("EXPANDED");
    // A ring does not push a live call aside.
    const busy = run([{ type: "open", target: room }]);
    expect(windowReducer(busy, { type: "ring", target: call })).toBe(busy);
  });

  it("closes from every mode", () => {
    for (const events of [
      [{ type: "open", target: call }],
      [{ type: "open", target: call }, { type: "minimize" }],
      [{ type: "open", target: call }, { type: "fullscreen" }],
      [{ type: "ring", target: call }],
    ] as WindowEvent[][]) {
      expect(run([...events, { type: "close" }])).toEqual(initialWindow);
    }
  });
});

describe("call window geometry", () => {
  const vp = { w: 1280, h: 720 };

  it("starts top right below the header", () => {
    const r = defaultRect(vp);
    expect(r.y).toBe(WINDOW.topOffset);
    expect(r.x + r.w).toBe(vp.w - WINDOW.rightOffset);
  });

  it("never goes below the minimum or above 80 percent of the screen", () => {
    const small = clampRect({ x: 0, y: 0, w: 10, h: 10 }, vp);
    expect(small.w).toBe(WINDOW.minW);
    expect(small.h).toBe(WINDOW.minH);
    const big = clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, vp);
    expect(big.w).toBe(Math.round(vp.w * 0.8));
    expect(big.h).toBe(Math.round(vp.h * 0.8));
  });

  it("keeps the window inside the screen while dragging, whatever the pointer does", () => {
    const start = { x: 800, y: 72, w: 480, h: 380 };
    const far = dragRect(start, 5000, 5000, vp);
    expect(far.x + far.w).toBeLessThanOrEqual(vp.w - WINDOW.margin);
    expect(far.y + far.h).toBeLessThanOrEqual(vp.h - WINDOW.margin);
    const back = dragRect(start, -5000, -5000, vp);
    expect(back.x).toBe(WINDOW.margin);
    expect(back.y).toBe(WINDOW.margin);
  });

  it("snaps to an edge or corner that is within reach, and leaves the rest alone", () => {
    const corner = snapRect({ x: 20, y: 30, w: 480, h: 380 }, vp);
    expect(corner).toMatchObject({ x: WINDOW.margin, y: WINDOW.margin });
    const bottomRight = snapRect({ x: 780, y: 320, w: 480, h: 380 }, vp);
    expect(bottomRight.x + bottomRight.w).toBe(vp.w - WINDOW.margin);
    expect(bottomRight.y + bottomRight.h).toBe(vp.h - WINDOW.margin);
    const middle = snapRect({ x: 400, y: 200, w: 480, h: 300 }, vp);
    expect(middle).toEqual({ x: 400, y: 200, w: 480, h: 300 });
  });

  it("resizes from the corner it is pulled by and holds the opposite side", () => {
    const start = { x: 700, y: 100, w: 480, h: 380 };
    const nw = resizeRect(start, "nw", -100, -50, vp);
    expect(nw.x + nw.w).toBe(start.x + start.w);
    expect(nw.y + nw.h).toBe(start.y + start.h);
    expect(nw.w).toBe(580);
    const se = resizeRect(start, "se", 50, 40, vp);
    expect(se).toMatchObject({ x: 700, y: 100, w: 530, h: 420 });
    const tooSmall = resizeRect(start, "se", -999, -999, vp);
    expect(tooSmall.w).toBe(WINDOW.minW);
    expect(tooSmall.h).toBe(WINDOW.minH);
  });

  it("keeps a 16 by 9 picture when asked to", () => {
    const r = resizeRect({ x: 600, y: 80, w: 480, h: 380 }, "e", 80, 0, vp, 16 / 9);
    expect(r.w).toBe(560);
    expect(Math.abs(r.h - (560 / (16 / 9) + WINDOW.headerH))).toBeLessThanOrEqual(1);
  });

  it("reads a saved rect only when it is four numbers, and treats narrow screens as phones", () => {
    expect(parseRect({ x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(parseRect({ x: 1, y: "2", w: 3, h: 4 })).toBeNull();
    expect(parseRect(null)).toBeNull();
    expect(isPhone({ w: 390, h: 800 })).toBe(true);
    expect(isPhone({ w: 1024, h: 768 })).toBe(false);
  });
});
