"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const KEY = "gr_calm";
const EVENT = "gr:calm";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The visitor's own "Reduce animations" choice. It is a per viewer convenience, so localStorage is fine. */
export function useCalmSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = (value: boolean) => {
    try {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      // Without storage the choice only lasts for this visit.
    }
    document.documentElement.toggleAttribute("data-calm", value);
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}

/** True when decorative motion should stop: the device asks for less motion, or the visitor chose to reduce animations. */
export function useCalm(): boolean {
  const reduced = useReducedMotion();
  const [setting] = useCalmSetting();
  // CSS loops (pulses, bounces) stop through this attribute.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-calm", setting);
  }, [setting]);
  return Boolean(reduced) || setting;
}
