"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { footer } from "@/content/landing";
import { cn } from "@/lib/cn";

const BARS = 28;

/** Fixed, pseudo random bar heights so the waveform looks like a voice note and never changes between renders. */
const HEIGHTS: number[] = Array.from({ length: BARS }, (_, i) => {
  const v = Math.abs(Math.sin(i * 1.7) * 0.55 + Math.sin(i * 0.63 + 1.2) * 0.45);
  return 0.3 + v * 0.7;
});

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/** Page position from 0 to 1, read from native scroll events so it keeps working when animation frames are throttled. */
export function useScrollProgress(): { progress: number; awake: boolean } {
  const [progress, setProgress] = useState(0);
  const [awake, setAwake] = useState(false);
  const idle = useRef<number | undefined>(undefined);

  useEffect(() => {
    function read() {
      const max = maxScroll();
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    }
    function onScroll() {
      read();
      setAwake(true);
      window.clearTimeout(idle.current);
      idle.current = window.setTimeout(() => setAwake(false), 1400);
    }
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
      window.clearTimeout(idle.current);
    };
  }, []);

  return { progress, awake };
}

export function seekPage(ratio: number): void {
  window.scrollTo({ top: Math.min(1, Math.max(0, ratio)) * maxScroll(), behavior: "auto" });
}

/**
 * The page as a voice note: a horizontal waveform fixed at the bottom centre of the page on desktop.
 * Green bars are played, the yellow bar is where you are. Drag, tap or use the keys to seek.
 * It replaces the usual back to top button (Decisions D27). Phones get the gauge in the dock instead.
 */
export function ScrollWave({ className }: { className?: string }) {
  const { progress, awake } = useScrollProgress();
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const playing = Math.min(BARS - 1, Math.floor(progress * BARS));
  const visible = progress > 0.01 || awake || dragging;

  const ratioFrom = useCallback((e: PointerEvent<HTMLDivElement>): number => {
    const rect = track.current?.getBoundingClientRect();
    return rect ? (e.clientX - rect.left) / rect.width : 0;
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.25 : 0.05;
    const next: Record<string, number | undefined> = {
      ArrowLeft: progress - step,
      ArrowUp: progress - step,
      PageUp: progress - 0.25,
      ArrowRight: progress + step,
      ArrowDown: progress + step,
      PageDown: progress + 0.25,
      Home: 0,
      End: 1,
    };
    const target = next[e.key];
    if (target === undefined) return;
    e.preventDefault();
    seekPage(target);
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-5 z-30 hidden justify-center transition-opacity duration-300 md:flex",
        visible ? "opacity-100" : "opacity-0 focus-within:opacity-100",
        className,
      )}
    >
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={footer.pagePosition}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${Math.round(progress * 100)}%`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          seekPage(ratioFrom(e));
        }}
        onPointerMove={(e) => dragging && seekPage(ratioFrom(e))}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={onKeyDown}
        className="pointer-events-auto flex h-12 w-72 cursor-pointer touch-none select-none items-center justify-between rounded-full border border-border bg-surface/95 px-4 shadow-soft backdrop-blur"
      >
        {HEIGHTS.map((h, i) => {
          const played = i <= playing;
          const current = i === playing;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                "w-[3px] shrink-0 rounded-full transition-colors",
                played ? (current ? "bg-yellow-400" : "bg-green-600") : "bg-border",
              )}
              style={{ height: `${Math.round(h * 1.5 * 100) / 100}rem` }}
            />
          );
        })}
      </div>
    </div>
  );
}

const SIZE = 80;
const C = SIZE / 2;
const GR = 34;
const START = -135; // degrees clockwise from 12 o'clock: the dial starts at lower left, sweeps over the top and ends at lower right
const SWEEP = 270;
const TICKS = 28;

function polar(deg: number, r: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

/** On phones the same progress becomes a speedometer dial around the centred chat icon in the dock. */
export function ScrollGauge({ className }: { className?: string }) {
  const { progress } = useScrollProgress();
  const needle = START + SWEEP * progress;
  const tip = polar(needle, GR - 2);
  const base = polar(needle, GR - 9);
  return (
    <svg
      aria-hidden
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn(
        "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        className,
      )}
    >
      {Array.from({ length: TICKS + 1 }, (_, i) => {
        const frac = i / TICKS;
        const major = i % 7 === 0;
        const a = polar(START + SWEEP * frac, GR);
        const b = polar(START + SWEEP * frac, GR - (major ? 6 : 3.5));
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            strokeWidth={major ? 2 : 1.4}
            strokeLinecap="round"
            className={frac <= progress ? "stroke-green-600" : "stroke-border"}
          />
        );
      })}
      <line
        x1={base.x}
        y1={base.y}
        x2={tip.x}
        y2={tip.y}
        strokeWidth={2.5}
        strokeLinecap="round"
        className="stroke-yellow-400 transition-all duration-150"
      />
    </svg>
  );
}
