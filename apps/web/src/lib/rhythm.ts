import type { Tone } from "@/components/public/sections";

/**
 * The ordered background of every section on each public page, hero first and closing band last.
 * No two neighbours may share a strong background (green, ink or yellow). tests/unit/rhythm.test.ts enforces it.
 */
export const rhythm = {
  features: ["green", "plain", "soft", "ink", "green"],
  about: ["green", "plain", "soft", "yellow", "green"],
  security: ["green", "plain", "soft", "ink", "green"],
  safety: ["green", "plain", "soft", "green", "plain", "ink", "green"],
  install: ["green", "plain", "soft", "green"],
  rooms: ["green", "plain"],
  prose: ["green", "plain"],
} as const satisfies Record<string, readonly Tone[]>;

export const STRONG_TONES: readonly Tone[] = ["green", "ink", "yellow"];

/** Pairs of neighbours that share a strong background. Empty when the page rhythm is fine. */
export function clashes(tones: readonly Tone[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i < tones.length; i++) {
    const a = tones[i - 1];
    if (a && a === tones[i] && STRONG_TONES.includes(a)) out.push([i - 1, i]);
  }
  return out;
}
