"use client";

import { cn } from "@/lib/cn";
import { useChips, type ChipKind } from "@/lib/session/chips";

const tone: Record<ChipKind, string> = {
  join: "bg-green-600 text-white",
  leave: "bg-ink-700 text-white",
  mod: "bg-yellow-400 text-ink-950",
  info: "bg-ink-950 text-white",
  back: "bg-green-600 text-white",
  call: "bg-ink-950 text-white",
};

/**
 * Small notices inside a call or a room: someone joined, someone left, someone was muted. They fade out by
 * themselves and never carry a button. This is the one place a short notice is allowed to appear (R4).
 */
export function ActivityChips({ className }: { className?: string }) {
  const chips = useChips((s) => s.chips);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-relevant="additions"
      className={cn(
        "pointer-events-none fixed bottom-24 left-4 z-[65] flex max-w-[min(80vw,22rem)] flex-col gap-2",
        className,
      )}
    >
      {chips.map((c) => (
        <span
          key={c.id}
          className={cn(
            "w-fit rounded-full px-4 py-2 text-sm font-semibold shadow-soft",
            tone[c.kind],
          )}
        >
          {c.text}
        </span>
      ))}
    </div>
  );
}
