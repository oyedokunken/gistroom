"use client";

import { create } from "zustand";

/** Chrome's install prompt event. It is not in the DOM typings. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "gr_install_dismissed_until";
const WAIT_DAYS = 14;

/** Never nag: after a dismissal the card stays away for 14 days (Section 11). */
export function dismissedUntil(stored: string | null, now: Date = new Date()): boolean {
  if (!stored) return false;
  const until = Number(stored);
  return Number.isFinite(until) && until > now.getTime();
}

export function nextDismissal(now: Date = new Date()): number {
  return now.getTime() + WAIT_DAYS * 86_400_000;
}

interface PwaState {
  prompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  dismissed: boolean;
  setPrompt: (p: BeforeInstallPromptEvent | null) => void;
  setInstalled: () => void;
  loadDismissed: () => void;
  dismiss: () => void;
}

export const usePwa = create<PwaState>((set) => ({
  prompt: null,
  installed: false,
  dismissed: false,
  setPrompt: (prompt) => set({ prompt }),
  setInstalled: () => set({ installed: true, prompt: null }),
  loadDismissed: () => {
    try {
      set({ dismissed: dismissedUntil(window.localStorage.getItem(DISMISS_KEY)) });
    } catch {
      set({ dismissed: false });
    }
  },
  dismiss: () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(nextDismissal()));
    } catch {
      // Storage blocked: the card only hides for this visit.
    }
    set({ dismissed: true });
  },
}));
