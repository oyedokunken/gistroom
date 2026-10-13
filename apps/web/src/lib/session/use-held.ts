"use client";

import { useEffect, useRef, useState } from "react";
import { NET } from "./config";
import { holdStart, holdStep, type Hold } from "./connection-machine";

/**
 * A condition that has to hold before anyone reacts to it: on after `showAfterMs`, off after `clearAfterMs`. A line
 * that flaps never turns it on, so a dialog never flickers.
 */
export function useHeld(
  active: boolean,
  showAfterMs: number = NET.showAfterMs,
  clearAfterMs: number = NET.clearAfterMs,
): boolean {
  const [hold, setHold] = useState<Hold>(holdStart);
  const latest = useRef(active);
  latest.current = active;
  useEffect(() => {
    const id = window.setInterval(
      () => setHold((h) => holdStep(h, latest.current, Date.now(), showAfterMs, clearAfterMs)),
      500,
    );
    return () => window.clearInterval(id);
  }, [showAfterMs, clearAfterMs]);
  return hold.on;
}

/** The time now, updated every second, for counters. Stops while `running` is false. */
export function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return now;
}
