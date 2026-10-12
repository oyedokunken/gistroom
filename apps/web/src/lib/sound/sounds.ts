"use client";

import { DEFAULT_SOUNDS, SoundManager, type SoundSettings } from "./sound-manager";

const KEY = "gr_sound_settings_v1";

export function loadSoundSettings(): SoundSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SOUNDS };
    const v = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      master:
        typeof v.master === "number" ? Math.min(1, Math.max(0, v.master)) : DEFAULT_SOUNDS.master,
      calls: typeof v.calls === "boolean" ? v.calls : DEFAULT_SOUNDS.calls,
      rooms: typeof v.rooms === "boolean" ? v.rooms : DEFAULT_SOUNDS.rooms,
      messages: typeof v.messages === "boolean" ? v.messages : DEFAULT_SOUNDS.messages,
    };
  } catch {
    return { ...DEFAULT_SOUNDS };
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private windows can refuse storage. The choice then lasts for this visit.
  }
  sounds().configure(settings);
}

/** Set by the app shell once the person's quiet hours are known. */
let quietNow: () => boolean = () => false;
export function setQuietCheck(fn: () => boolean): void {
  quietNow = fn;
}

let manager: SoundManager | null = null;

/** The one sound manager. It is made on first use, in the browser only. */
export function sounds(): SoundManager {
  if (manager) return manager;
  manager = new SoundManager({
    createContext: () => new AudioContext(),
    now: () => performance.now(),
    hidden: () => document.visibilityState === "hidden",
    quiet: () => quietNow(),
    vibrate: (p) => {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(p);
    },
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id as number),
  });
  manager.configure(loadSoundSettings());
  const unlock = () => manager?.unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return manager;
}
