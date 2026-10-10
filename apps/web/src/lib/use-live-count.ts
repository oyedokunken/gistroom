"use client";

import { useEffect, useState } from "react";

/** Live public Room count from /api/public/stats. Null while loading, on error, or at zero. */
export function useLiveCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/stats", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { liveRooms?: unknown } | null) => {
        const n = typeof data?.liveRooms === "number" ? data.liveRooms : 0;
        setCount(n > 0 ? n : null);
      })
      .catch(() => setCount(null));
    return () => controller.abort();
  }, []);
  return count;
}
