"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Phone, SignalLow, Video } from "lucide-react";
import { PhoneFrame } from "@/components/mock/phone";
import { AudioCallScreen, VideoCallScreen } from "@/components/mock/screens";
import { AnimatedArt } from "@/components/public/animated-art";
import { CardIcon } from "@/components/public/card-icon";
import { homeCopy as copy } from "@/content/home";
import { mockLabels as L } from "@/content/marketing";
import { useCalm } from "@/lib/calm";
import { cn } from "@/lib/cn";
import { useActiveStep } from "./how-it-works";

// ---------- Calls that switch ----------

const CALL_POINT_ICONS = [Phone, Video, SignalLow] as const;

/** One phone that goes from an audio call to a video call and back, and answers a tap on the button. */
export function CallsSwitch() {
  const calm = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [video, setVideo] = useState(false);
  useEffect(() => {
    if (!inView || calm) return;
    const id = window.setInterval(() => setVideo((v) => !v), 4200);
    return () => window.clearInterval(id);
  }, [inView, calm]);
  return (
    <div
      ref={ref}
      className="grid grid-cols-[minmax(0,1fr)] gap-12 md:grid-cols-2 md:items-stretch md:gap-20"
    >
      <div className="order-2 flex h-full flex-col justify-center md:order-1">
        <CardIcon name="switch" className="mb-5 hidden md:inline-flex" />
        <h2
          id="calls-h"
          className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
        >
          {copy.calls.title}
        </h2>
        <p className="mt-4 max-w-[48ch] text-lg text-white/80">{copy.calls.lead}</p>
        <ul className="mt-6 flex flex-col gap-3 text-white/90">
          {copy.calls.points.map((p, i) => {
            const Icon = CALL_POINT_ICONS[i % CALL_POINT_ICONS.length] ?? Phone;
            return (
              <li key={p} className="flex items-center gap-3">
                <Icon aria-hidden className="size-4 shrink-0 text-yellow-400" />
                <span>{p}</span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          aria-pressed={video}
          onClick={() => setVideo((v) => !v)}
          className="mt-8 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-yellow-400 px-6 font-semibold text-ink-950"
        >
          {video ? (
            <Phone aria-hidden className="size-5" />
          ) : (
            <Video aria-hidden className="size-5" />
          )}
          {video ? "Back to audio" : "Add video"}
        </button>
      </div>
      <div className="order-1 flex h-full flex-col items-start justify-center md:order-2 md:items-center">
        <PhoneFrame label={video ? L.video : L.audio}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={video ? "video" : "audio"}
              className="flex min-h-0 flex-1 flex-col"
              initial={calm ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              {video ? <VideoCallScreen person="Emeka" /> : <AudioCallScreen person="Emeka" />}
            </motion.div>
          </AnimatePresence>
        </PhoneFrame>
      </div>
    </div>
  );
}

// ---------- Everywhere ----------

/** A scene story: the picture changes as each time of day scrolls past. Stacked, with a picture each, on phones. */
export function Everywhere() {
  const { active, attach } = useActiveStep();
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.75", "end 0.45"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 md:gap-16">
      <div className="hidden md:block">
        <div className="sticky top-0 flex h-screen items-center justify-center">
          <div className="relative aspect-square w-full">
            {copy.everywhere.chapters.map((c, i) => (
              <div
                key={c.id}
                aria-hidden={active !== i}
                className={cn(
                  "absolute inset-0 transition-opacity duration-500",
                  active === i ? "opacity-100" : "opacity-0",
                )}
              >
                {active === i ? (
                  <AnimatedArt
                    id={c.id}
                    alt={c.alt}
                    width={720}
                    height={720}
                    className="size-full"
                  />
                ) : null}
              </div>
            ))}
            <span className="tabular absolute bottom-4 left-4 z-10 rounded-full bg-ink-950/75 px-4 py-1.5 text-sm font-semibold text-white">
              {copy.everywhere.progress(active + 1, copy.everywhere.chapters.length)}
            </span>
          </div>
        </div>
      </div>
      <ol ref={listRef} className="relative flex flex-col gap-12 md:gap-[34vh] md:py-16">
        {copy.everywhere.chapters.map((c, i) => (
          <EverywhereChapter
            key={c.id}
            c={c}
            i={i}
            total={copy.everywhere.chapters.length}
            active={active}
            attach={attach}
            progress={progress}
          />
        ))}
      </ol>
    </div>
  );
}

/** One chapter in the scroll story, with its slice of the progress line from node to node. */
function EverywhereChapter({
  c,
  i,
  total,
  active,
  attach,
  progress,
}: {
  c: (typeof copy.everywhere.chapters)[number];
  i: number;
  total: number;
  active: number;
  attach: (i: number) => (el: Element | null) => void;
  progress: MotionValue<number>;
}) {
  const isLast = i === total - 1;
  const seg = useTransform(progress, [i / total, (i + 1) / total], [0, 1]);
  const segCls = cn(
    "absolute left-[14.5px] top-[calc(20px_+_clamp(1.19rem,2.312vw,1.7rem))] w-[3px] rounded-full",
    isLast
      ? "h-8"
      : "-bottom-[calc(84px_+_clamp(1.19rem,2.312vw,1.7rem))] md:-bottom-[calc(34vh_+_36px_+_clamp(1.19rem,2.312vw,1.7rem))]",
  );
  return (
    <li ref={attach(i)} aria-current={active === i ? "step" : undefined} className="relative ps-12">
      <span aria-hidden className={cn(segCls, "bg-green-100")} />
      <motion.span
        aria-hidden
        style={{ scaleY: seg }}
        className={cn(segCls, "origin-top bg-green-600")}
      />
      <p className="flex h-8 items-center text-sm font-bold text-green-700">{c.time}</p>
      <h3 className="relative mt-1 text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em]">
        <span
          aria-hidden
          className={cn(
            "tabular absolute -left-12 top-[0.68em] flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-sm font-black transition-colors",
            i <= active
              ? "bg-yellow-400 text-ink-950"
              : "bg-surface text-text-muted ring-1 ring-border",
          )}
        >
          {i + 1}
        </span>
        {c.title}
      </h3>
      <p className="mt-3 max-w-[46ch] text-lg text-text-muted">{c.body}</p>
      <div className="mt-6 aspect-square max-w-sm md:hidden">
        <AnimatedArt id={c.id} alt={c.alt} width={720} height={720} className="size-full" />
      </div>
    </li>
  );
}
