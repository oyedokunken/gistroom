"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

const PHOTOS = [
  "/images/maker/maker-1.webp",
  "/images/maker/maker-2.webp",
  "/images/maker/maker-3.webp",
  "/images/maker/maker-4.webp",
] as const;

const spring = { type: "spring", stiffness: 260, damping: 26 } as const;

/**
 * Four portraits piled like a stack of cards. Every few seconds the top card slides off and drops to the back.
 * It pauses off screen and stands still for visitors who prefer reduced motion.
 */
export function MakerStack({ alt }: { alt: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.3 });
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3]);
  const [leaving, setLeaving] = useState<number | null>(null);

  useEffect(() => {
    if (reduced || !visible) return;
    const id = window.setInterval(() => {
      setOrder((o) => {
        setLeaving(o[0] ?? null);
        return o;
      });
      window.setTimeout(() => {
        setOrder((o) => [...o.slice(1), o[0] as number]);
        setLeaving(null);
      }, 520);
    }, 3400);
    return () => window.clearInterval(id);
  }, [reduced, visible]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={alt}
      className="relative mx-auto aspect-[4/5] w-[min(18rem,72vw)] shrink-0 md:w-72"
    >
      <AnimatePresence initial={false}>
        {order
          .map((photo, depth) => ({ photo, depth }))
          .reverse()
          .map(({ photo, depth }) => {
            const out = leaving === photo;
            const tilt = [0, -5, 5, -9][depth] ?? 0;
            return (
              <motion.div
                key={photo}
                layout={!reduced}
                initial={false}
                animate={{
                  x: out ? 150 : depth * 10,
                  y: depth * -10,
                  rotate: out ? 14 : tilt,
                  scale: 1 - depth * 0.04,
                  opacity: out ? 0.2 : 1,
                  zIndex: out ? 5 : 10 - depth,
                }}
                transition={reduced ? { duration: 0 } : spring}
                className="absolute inset-0 overflow-hidden rounded-card border-4 border-white bg-surface-2 shadow-lift"
              >
                <Image
                  src={PHOTOS[photo] ?? PHOTOS[0]}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 72vw, 288px"
                  className="object-cover"
                  priority={depth === 0}
                />
              </motion.div>
            );
          })}
      </AnimatePresence>
    </div>
  );
}
