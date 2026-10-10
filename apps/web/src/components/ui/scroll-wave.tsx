"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useReducedMotion } from "motion/react";
import { footer } from "@/content/landing";
import { cn } from "@/lib/cn";

const BARS = 36;

/** Fixed, pseudo random bar heights so the waveform looks like a voice note and never changes between renders. */
const HEIGHTS: number[] = Array.from({ length: BARS }, (_, i) => {
  const v = Math.abs(Math.sin(i * 1.7) * 0.55 + Math.sin(i * 0.63 + 1.2) * 0.45);
  return 0.28 + v * 0.72;
});

function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/**
 * The page as a voice note. A waveform shows how far you have played through the page, and you scrub
 * it like an audio timeline: drag, tap or use the arrow keys. It replaces the usual back to top button.
 * Vertical on the right edge from tablet up, a strip above the dock on phones.
 */
export function ScrollWave() {
  const reduced = useReducedMotion();
  const wide = useWide();
  const [progress, setProgress] = useState(0);
  const [pastStart, setPastStart] = useState(false);
  const [awake, setAwake] = useState(false);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const idle = useRef<number | undefined>(undefined);

  const wake = useCallback(() => {
    setAwake(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setAwake(false), 1600);
  }, []);

  // Native scroll events, so the wave still wakes when frames are throttled (hidden tab, low power).
  useEffect(() => {
    function read() {
      const max = maxScroll();
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      setPastStart(window.scrollY > 240);
    }
    function onScroll() {
      read();
      wake();
    }
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
      window.clearTimeout(idle.current);
    };
  }, [wake]);

  function seekTo(ratio: number) {
    const clamped = Math.min(1, Math.max(0, ratio));
    window.scrollTo({ top: clamped * maxScroll(), behavior: "auto" });
  }

  function ratioFromPointer(e: PointerEvent<HTMLDivElement>): number {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return 0;
    return wide ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    seekTo(ratioFromPointer(e));
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging) seekTo(ratioFromPointer(e));
  }
  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.25 : 0.05;
    const keys: Record<string, number | undefined> = {
      ArrowUp: progress - step,
      ArrowLeft: progress - step,
      PageUp: progress - 0.25,
      ArrowDown: progress + step,
      ArrowRight: progress + step,
      PageDown: progress + 0.25,
      Home: 0,
      End: 1,
    };
    const next = keys[e.key];
    if (next === undefined) return;
    e.preventDefault();
    seekTo(next);
  }

  const playing = Math.min(BARS - 1, Math.floor(progress * BARS));
  const visible = pastStart;
  const loud = awake || dragging;

  return (
    <div
      className={cn(
        "fixed z-30 transition-opacity duration-300",
        wide
          ? "right-3 top-1/2 h-[min(46vh,22rem)] w-9 -translate-y-1/2"
          : "inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] h-9",
        visible
          ? loud
            ? "opacity-100"
            : wide
              ? "opacity-45 hover:opacity-100 focus-within:opacity-100"
              : "opacity-0 focus-within:opacity-100"
          : "pointer-events-none opacity-0",
      )}
    >
      <div
        ref={track}
        role="slider"
        tabIndex={visible ? 0 : -1}
        aria-label={footer.pagePosition}
        aria-orientation={wide ? "vertical" : "horizontal"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${Math.round(progress * 100)}%`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className={cn(
          "flex size-full cursor-pointer touch-none select-none items-center justify-between rounded-full bg-surface/90 shadow-soft backdrop-blur",
          wide ? "flex-col px-1.5 py-3" : "flex-row px-4",
        )}
      >
        {HEIGHTS.map((h, i) => {
          const played = i <= playing;
          const current = i === playing;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                "shrink-0 rounded-full transition-colors",
                wide ? "h-[2px]" : "w-[2px]",
                played ? (current ? "bg-yellow-400" : "bg-green-600") : "bg-border",
                current && !reduced && "scale-y-125",
              )}
              style={wide ? { width: `${h * 100}%` } : { height: `${h * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
