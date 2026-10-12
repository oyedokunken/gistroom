"use client";

import { create } from "zustand";

export type UpdateBlocker = "call" | "room" | "draft";

/**
 * What should stop a new version from being applied right now: a call on screen or ringing, a live room open,
 * or text that was typed and not sent. Pure, so the rule is tested without a browser.
 */
export function updateBlockers(input: {
  pathname: string;
  ringing: boolean;
  drafts: Record<string, string>;
}): UpdateBlocker[] {
  const out: UpdateBlocker[] = [];
  if (input.ringing || /^\/app\/call\//.test(input.pathname)) out.push("call");
  if (/^\/app\/rooms\/[^/]+/.test(input.pathname)) out.push("room");
  if (Object.values(input.drafts).some((text) => text.trim().length > 0)) out.push("draft");
  return out;
}

interface UpdateState {
  /** The new worker, waiting for its turn. */
  waiting: ServiceWorker | null;
  /** The person closed the bar. It stays closed until the next version. */
  dismissed: boolean;
  setWaiting: (worker: ServiceWorker | null) => void;
  dismiss: () => void;
}

export const useUpdate = create<UpdateState>((set) => ({
  waiting: null,
  dismissed: false,
  setWaiting: (waiting) => set({ waiting, dismissed: false }),
  dismiss: () => set({ dismissed: true }),
}));

let applying = false;

/** Tells the waiting worker to take over. The page reloads once when it does (see PwaRuntime). */
export function applyUpdate(): boolean {
  const { waiting } = useUpdate.getState();
  if (!waiting) return false;
  applying = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

/** True only after this app asked for the swap, so a worker taking over for any other reason never reloads the page. */
export function isApplying(): boolean {
  return applying;
}
