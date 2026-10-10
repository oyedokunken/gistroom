"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { AnimatedArt } from "@/components/public/animated-art";
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
    <section className="relative mx-auto grid max-w-[1200px] items-stretch gap-8 overflow-hidden px-6 pb-24 pt-24 md:grid-cols-2 md:gap-12 md:pb-28 md:pt-32">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full text-green-600 opacity-[0.07]"
      >
        <defs>
          <pattern id="hero-grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0H0V44" fill="none" stroke="currentColor" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
      <div className="relative flex flex-col items-start justify-center gap-6 md:min-h-[34rem]">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-semibold text-text">
          <span aria-hidden className="size-2 rounded-full bg-green-600" />
          {hero.kicker}
        </span>
        <h1 className="text-[clamp(2.75rem,8.5vw,5rem)] font-black leading-[1.02] tracking-[-0.035em] text-text">
          {hero.headline}
        </h1>
        <p className="max-w-[52ch] text-lg text-text-muted">{hero.subhead}</p>
        <div className="flex flex-wrap gap-3">
          <Link href={hero.primary.href} className={buttonStyles("primary", "min-h-12 px-7")}>
            {hero.primary.label}
          </Link>
          <Link href={hero.secondary.href} className={buttonStyles("accent", "min-h-12 px-7")}>
            {hero.secondary.label}
          </Link>
        </div>
      </div>

      <div
        ref={stage}
        onPointerMove={onMove}
        role="img"
        aria-label={hero.stageLabel}
        className="relative order-first aspect-[4/3] min-h-[20rem] w-full overflow-hidden rounded-hero bg-green-100 shadow-lift md:order-none md:aspect-auto md:min-h-[34rem]"
      >
        <motion.div className="absolute -inset-4" style={{ x: backX, y: backY }}>
          <Image
            src="/images/scenes/hero-back.png"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 540px"
            className="object-cover"
          />
        </motion.div>
        <motion.div className="absolute inset-0" style={{ x: midX, y: midY }}>
          <AnimatedArt
            id="hero-mid"
            alt=""
            width={720}
            height={480}
            priority
            className="absolute inset-0 size-full object-cover"
          />
          <SpeakingRing className="left-[22%] top-[38%] size-[14%]" run={run} />
          <SpeakingRing className="right-[24%] top-[46%] size-[12%]" run={run} delay={0.6} />
        </motion.div>
        <SoundBars run={run} />
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ x: frontX, y: frontY }}
        >
          <Image
            src="/images/scenes/hero-front.png"
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
