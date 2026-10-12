"use client";

import { create } from "zustand";
import { pushChip } from "./chips";

/** From the most urgent to the least. A lower one waits while a higher one is open. */
export type ModalPriority = "removed" | "ended" | "disconnected" | "blocked" | "offline" | "info";

const RANK: Record<ModalPriority, number> = {
  removed: 5,
  ended: 4,
  disconnected: 3,
  blocked: 2,
  offline: 1,
  info: 0,
};

export type ModalIcon =
  | "wifi-off"
  | "refresh"
  | "unplug"
  | "alert"
  | "mic-off"
  | "video-off"
  | "phone-off"
  | "phone-missed"
  | "users"
  | "log-out"
  | "lock"
  | "volume"
  | "smartphone"
  | "external"
  | "clock"
  | "radio";

export interface SessionAction {
  id: string;
  label: string;
  kind?: "primary" | "secondary" | "danger";
  run?: () => void | Promise<void>;
  /** Close the dialog after the action. Default true. */
  closes?: boolean;
}

export interface SessionModalSpec {
  /** Stable key. Showing the same id again updates the open one instead of stacking a second. */
  id: string;
  priority: ModalPriority;
  title: string;
  body: string;
  icon: ModalIcon;
  /** Shown under the body as a live "Trying for 0:12" counter. */
  counter?: { since: number; label: (mmss: string) => string };
  /** Extra lines such as the steps for allowing the microphone. */
  steps?: readonly string[];
  actions: readonly SessionAction[];
  /** Runs when the dialog goes away for any reason. */
  onClose?: () => void;
}

interface ModalStore {
  list: (SessionModalSpec & { order: number })[];
  counter: number;
  show: (spec: SessionModalSpec) => void;
  /** Close because the condition is over. With `back` a short "You're back" chip confirms it. */
  clear: (id: string, opts?: { back?: string }) => void;
  /** The person closed it. */
  dismiss: (id: string) => void;
  has: (id: string) => boolean;
}

/** The one to show now: the highest priority, and the oldest among equals. Pure, so it can be tested. */
export function pickCurrent<T extends { priority: ModalPriority; order: number }>(
  list: readonly T[],
): T | null {
  let best: T | null = null;
  for (const m of list) {
    if (!best || RANK[m.priority] > RANK[best.priority]) best = m;
    else if (RANK[m.priority] === RANK[best.priority] && m.order < best.order) best = m;
  }
  return best;
}

export const useSessionModals = create<ModalStore>((set, get) => ({
  list: [],
  counter: 0,
  show: (spec) =>
    set((s) => {
      const existing = s.list.find((m) => m.id === spec.id);
      if (existing) {
        // A duplicate of an open modal is dropped, but its words and counter stay current.
        return { list: s.list.map((m) => (m.id === spec.id ? { ...spec, order: m.order } : m)) };
      }
      return { list: [...s.list, { ...spec, order: s.counter }], counter: s.counter + 1 };
    }),
  clear: (id, opts) => {
    const gone = get().list.find((m) => m.id === id);
    if (!gone) return;
    set((s) => ({ list: s.list.filter((m) => m.id !== id) }));
    gone.onClose?.();
    if (opts?.back) pushChip({ text: opts.back, kind: "back" });
  },
  dismiss: (id) => {
    const gone = get().list.find((m) => m.id === id);
    if (!gone) return;
    set((s) => ({ list: s.list.filter((m) => m.id !== id) }));
    gone.onClose?.();
  },
  has: (id) => get().list.some((m) => m.id === id),
}));

/** Show a session modal from anywhere. */
export const showSessionModal = (spec: SessionModalSpec) => useSessionModals.getState().show(spec);
export const clearSessionModal = (id: string, opts?: { back?: string }) =>
  useSessionModals.getState().clear(id, opts);
