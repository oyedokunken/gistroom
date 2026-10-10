"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export const MAKER_PHOTOS = [
  "/images/maker/maker-1.webp",
  "/images/maker/maker-2.webp",
  "/images/maker/maker-3.webp",
  "/images/maker/maker-4.webp",
] as const;

const SIZE = 40;
const RING = 3;
const R = (SIZE - RING * 2) / 2;
const C = 2 * Math.PI * R;
const LAP_MS = 4000;

/**
 * The maker portraits, one at a time, inside the developer site button. A green ring draws itself
 * around the current face; the moment it closes the lap the photo swaps and the ring starts again.
 * Stays on the first photo for visitors who prefer reduced motion.
 */
export function MakerRing({ photos }: { photos: readonly string[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  return (
    <span className="relative block shrink-0" style={{ width: SIZE, height: SIZE }}>
      <AnimatePresence initial={false}>
        <motion.img
          key={index}
          src={photos[index]}
          alt=""
          width={SIZE - 12}
          height={SIZE - 12}
          initial={reduced ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? undefined : { opacity: 0, scale: 1.25 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-1.5 rounded-full object-cover"
        />
      </AnimatePresence>
      <svg aria-hidden viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={RING}
        />
        {reduced ? (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--color-yellow-400)"
            strokeWidth={RING}
            strokeLinecap="round"
          />
        ) : (
          <motion.circle
            key={index}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--color-yellow-400)"
            strokeWidth={RING}
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: LAP_MS / 1000, ease: "linear" }}
            onAnimationComplete={() => setIndex((i) => (i + 1) % photos.length)}
          />
        )}
      </svg>
    </span>
  );
}
