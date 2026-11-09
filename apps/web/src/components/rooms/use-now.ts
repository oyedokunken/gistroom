"use client";

import { useEffect, useState } from "react";

/**
 * The current time, or null until the page is running in the browser. Server and first client render both see null, so
 * nothing that depends on the time can differ between them. It ticks, so countdowns stay right.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
