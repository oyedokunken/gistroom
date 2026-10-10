"use client";

import { motion, useReducedMotion } from "motion/react";
import { LogoMark } from "@/components/brand/logo-mark";

const BARS = 36;

/** One digit drawn in the display face, huge and heavy. */
function Digit({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="select-none text-[clamp(6rem,26vw,17rem)] font-black leading-[0.8] tracking-[-0.06em] text-text"
    >
      {children}
    </span>
  );
}

/** The zero is a speaking ring around the mark, with nobody speaking. The rings pulse slowly, the way a quiet room does. */
function QuietRing({ code }: { code: string }) {
  const reduced = useReducedMotion();
  return (
    <span
      aria-hidden
      className="relative inline-flex aspect-square w-[clamp(5rem,22vw,14rem)] items-center justify-center"
    >
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-[clamp(0.5rem,2.4vw,1.5rem)] border-green-600"
          style={{ opacity: i === 0 ? 1 : 0 }}
          animate={
            reduced
              ? undefined
              : i === 0
                ? { scale: [1, 1.04, 1] }
                : { scale: [1, 1.5], opacity: [0.5, 0] }
          }
          transition={{
            duration: i === 0 ? 3.2 : 3.2,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 1.2,
          }}
        />
      ))}
      <LogoMark size={64} className="size-[44%] text-text" />
      <span className="sr-only">{code}</span>
    </span>
  );
}

/**
 * A flat sound wave with one blip that walks across it now and then. It says "dead air" without a word.
 * Transform only, and still when the person asks for less motion (R18).
 */
function Flatline({ label }: { label: string }) {
  const reduced = useReducedMotion();
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-10 w-full max-w-md items-center justify-between"
    >
      {Array.from({ length: BARS }, (_, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="h-full w-[2px] origin-center rounded-full bg-text-muted"
          style={{ scaleY: 0.08 }}
          animate={
            reduced
              ? undefined
              : {
                  scaleY: [0.08, 1, 0.08],
                  backgroundColor: [
                    "var(--color-ink-500)",
                    "var(--color-yellow-400)",
                    "var(--color-ink-500)",
                  ],
                }
          }
          transition={{
            duration: 0.9,
            delay: i * 0.07,
            repeat: Infinity,
            repeatDelay: 3.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function DeadAir({ code, flatlineLabel }: { code: string; flatlineLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-center justify-center gap-[clamp(0.25rem,2vw,1.5rem)]">
        <Digit>4</Digit>
        <QuietRing code={code} />
        <Digit>4</Digit>
      </div>
      <Flatline label={flatlineLabel} />
    </div>
  );
}
