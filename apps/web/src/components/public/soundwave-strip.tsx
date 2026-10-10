"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/** A low strip of animated sound bars along the bottom of a band. Still for reduced motion. */
export function SoundwaveStrip({ className }: { className?: string }) {
  const calm = useReducedMotion();
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end gap-[3px] opacity-40",
        className,
      )}
    >
      {Array.from({ length: 72 }, (_, i) => (
        <motion.span
          key={i}
          className="w-full origin-bottom rounded-full bg-white/50"
          style={{ height: `${18 + ((i * 43) % 82)}%` }}
          animate={calm ? { scaleY: 1 } : { scaleY: [1, 0.35 + (i % 5) * 0.16, 1] }}
          transition={{ duration: 1.4 + (i % 4) * 0.2, repeat: Infinity, delay: i * 0.045 }}
        />
      ))}
    </div>
  );
}
