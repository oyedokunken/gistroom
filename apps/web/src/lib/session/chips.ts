"use client";

import { create } from "zustand";

export type ChipKind = "join" | "leave" | "mod" | "info" | "back" | "call";

export interface Chip {
  id: string;
  text: string;
  kind: ChipKind;
  /** Chips with the same key inside the coalesce window become one, with a count. */
  key?: string;
  count: number;
}

/** In-call and in-room notices. Short, quiet, never with a button. */
export const CHIP_LIFETIME_MS = 4000;
export const CHIP_MAX = 3;
/** A burst of the same kind inside this window shows as one chip: "5 people joined". */
export const COALESCE_MS = 3000;

interface ChipStore {
  chips: Chip[];
  push: (input: {
    text: string;
    kind?: ChipKind;
    /** Coalesce key. The next one inside the window replaces the text with `many(count)`. */
    key?: string;
    many?: (count: number) => string;
  }) => void;
  drop: (id: string) => void;
  clear: () => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSeen = new Map<string, { id: string; at: number; many?: (count: number) => string }>();

export const useChips = create<ChipStore>((set, get) => ({
  chips: [],
  push: ({ text, kind = "info", key, many }) => {
    const now = Date.now();
    const prev = key ? lastSeen.get(key) : undefined;
    const existing =
      prev && now - prev.at < COALESCE_MS ? get().chips.find((c) => c.id === prev.id) : undefined;
    if (key && existing && (many ?? prev?.many)) {
      const count = existing.count + 1;
      const make = many ?? prev?.many;
      set((s) => ({
        chips: s.chips.map((c) =>
          c.id === existing.id ? { ...c, count, text: make?.(count) ?? c.text } : c,
        ),
      }));
      lastSeen.set(key, { id: existing.id, at: now, many: make });
      clearTimeout(timers.get(existing.id));
      timers.set(
        existing.id,
        setTimeout(() => get().drop(existing.id), CHIP_LIFETIME_MS),
      );
      return;
    }
    const id = globalThis.crypto.randomUUID();
    if (key) lastSeen.set(key, { id, at: now, many });
    // Newest first, and at most three on screen.
    set((s) => ({ chips: [{ id, text, kind, key, count: 1 }, ...s.chips].slice(0, CHIP_MAX) }));
    timers.set(
      id,
      setTimeout(() => get().drop(id), CHIP_LIFETIME_MS),
    );
  },
  drop: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set((s) => ({ chips: s.chips.filter((c) => c.id !== id) }));
  },
  clear: () => {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    lastSeen.clear();
    set({ chips: [] });
  },
}));

export function pushChip(input: Parameters<ChipStore["push"]>[0]): void {
  useChips.getState().push(input);
}
