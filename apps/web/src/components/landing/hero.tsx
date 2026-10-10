"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { buttonStyles } from "@/components/ui/button";
import { hero } from "@/content/landing";

/** Pulsing ring that marks a speaker. Pauses off screen. */
function SpeakingRing({
  className,
  delay = 0,
  run,
}: {
  className: string;
  delay?: number;
  run: boolean;
}) {
  return (
    <span aria-hidden className={`absolute ${className}`}>
      <motion.span
        className="absolute inset-0 rounded-full border-4 border-green-600"
        animate={run ? { scale: [1, 1.5], opacity: [0.7, 0] } : { scale: 1, opacity: 0.5 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
      />
      <motion.span
        className="absolute inset-0 rounded-full border-4 border-green-600"
        animate={run ? { scale: [1, 1.5], opacity: [0.7, 0] } : { scale: 1, opacity: 0.5 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: delay + 0.9 }}
      />
    </span>
  );
}

function SoundBars({ run }: { run: boolean }) {
  const heights = [0.45, 0.8, 0.55, 1, 0.65, 0.9, 0.5, 0.75, 0.4];
  return (
    <div
      aria-hidden
      className="absolute inset-x-[12%] bottom-[10%] flex h-[22%] items-end justify-between"
    >
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-[5%] origin-bottom rounded-full bg-yellow-400"
          style={{ height: "100%", scaleY: h }}
          animate={run ? { scaleY: [h, Math.min(1, h + 0.35), h * 0.6, h] } : { scaleY: h }}
          transition={{
            duration: 1.4 + (i % 3) * 0.3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.12,
          }}
        />
      ))}
    </div>
  );
}

/** Short lines of sample gist drifting in and out. Decorative, so hidden from assistive tech. */
function DriftingGist({ run }: { run: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 3200);
    return () => window.clearInterval(id);
  }, [run]);
  const slots = [
    { cls: "left-[4%] top-[8%]", offset: 0 },
    { cls: "right-[4%] top-[30%]", offset: 2 },
    { cls: "left-[10%] top-[56%]", offset: 4 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {slots.map((slot, s) => {
        const index = (tick + slot.offset) % hero.gist.length;
        return (
          <div key={s} className={`absolute max-w-[62%] ${slot.cls}`}>
            <AnimatePresence mode="wait">
              <motion.p
                key={index}
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, delay: s * 0.25 }}
                className={`rounded-bubble px-4 py-2.5 text-sm font-medium shadow-soft ${
                  s === 1
                    ? "rounded-br-sm bg-green-600 text-white"
                    : "rounded-bl-sm bg-surface text-text"
                }`}
              >
                {hero.gist[index]}
              </motion.p>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function Hero() {
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { margin: "0px 0px -10% 0px" });
  const reduced = useReducedMotion();
  const run = inView && !reduced;

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 90, damping: 18 });
  const sy = useSpring(py, { stiffness: 90, damping: 18 });
  const midX = useTransform(sx, (v) => v * 14);
  const midY = useTransform(sy, (v) => v * 10);
  const frontX = useTransform(sx, (v) => v * 28);
  const frontY = useTransform(sy, (v) => v * 18);
  const backX = useTransform(sx, (v) => v * -8);
  const backY = useTransform(sy, (v) => v * -6);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 pb-24 pt-28 md:grid-cols-[1.05fr_1fr] md:pb-28 md:pt-36">
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-[clamp(2.75rem,8.5vw,5rem)] font-black leading-[1.02] tracking-[-0.035em] text-text">
          {hero.headline}
        </h1>
        <p className="max-w-[52ch] text-lg text-text-muted">{hero.subhead}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={hero.primary.href} className={buttonStyles("primary", "min-h-12 px-7")}>
            {hero.primary.label}
          </Link>
          <Link href={hero.secondary.href} className={buttonStyles("secondary", "min-h-12 px-7")}>
            {hero.secondary.label}
          </Link>
        </div>
      </div>

      <div
        ref={stage}
        onPointerMove={onMove}
        role="img"
        aria-label={hero.stageLabel}
        className="relative aspect-[3/2] w-full overflow-hidden rounded-hero bg-green-100 shadow-lift md:aspect-[4/5]"
      >
        <motion.div className="absolute -inset-4" style={{ x: backX, y: backY }}>
          <Image
            src="/images/hero-back-640.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 540px"
            className="object-cover"
          />
        </motion.div>
        <motion.div className="absolute inset-0" style={{ x: midX, y: midY }}>
          <Image
            src="/images/hero-mid-640.png"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 540px"
            className="object-cover"
          />
          <SpeakingRing className="left-[22%] top-[38%] size-[14%]" run={run} />
          <SpeakingRing className="right-[24%] top-[46%] size-[12%]" run={run} delay={0.6} />
        </motion.div>
        <SoundBars run={run} />
        <DriftingGist run={run} />
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ x: frontX, y: frontY }}
        >
          <Image
            src="/images/hero-front-640.png"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 540px"
            className="object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}
