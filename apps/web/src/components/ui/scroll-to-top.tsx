"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useMotionValueEvent } from "motion/react";
import { ArrowUp } from "lucide-react";
import { footer } from "@/content/landing";

const SIZE = 52;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;

/** Floating back to top button. The ring (52px) fills with scroll progress around a 38px inner circle. */
export function ScrollToTop() {
  const reduced = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 });
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setVisible(y > 400));
  useEffect(() => setVisible(window.scrollY > 400), []);

  return (
    <button
      type="button"
      aria-label={footer.scrollTop}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })}
      className={`fixed bottom-24 right-4 z-30 flex size-[52px] items-center justify-center rounded-full transition-[opacity,transform] md:bottom-6 md:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden
        className="absolute inset-0 -rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-border"
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          className="stroke-green-600"
          style={{ pathLength: progress }}
        />
      </svg>
      <span className="flex size-[38px] items-center justify-center rounded-full bg-green-600 text-white shadow-soft">
        <ArrowUp aria-hidden className="size-5" />
      </span>
    </button>
  );
}
