"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Hand, Mic } from "lucide-react";
import { type DemoPerson } from "@gistroom/shared";
import { PhoneFrame } from "@/components/mock/phone";
import { DataScreen, PersonAvatar } from "@/components/mock/screens";
import { AnimatedArt } from "@/components/public/animated-art";
import { AuthLink } from "@/components/public/auth-cta";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";
import { HeroActions } from "@/components/public/sections";
import { buttonStyles } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { homeCopy as copy } from "@/content/home";
import { cta } from "@/content/marketing";
import { useCalm } from "@/lib/calm";

// ---------- Safe by design ----------

export function SafeByDesign() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 md:gap-16">
      <div className="md:order-1">
        <h2
          id="safe-h"
          className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
        >
          {copy.safe.title}
        </h2>
        <p className="mt-4 max-w-[48ch] text-lg text-white/80">{copy.safe.lead}</p>
        <ul className="mt-8 flex flex-col gap-6">
          {copy.safe.points.map((p) => (
            <li key={p.title} className="group flex gap-4">
              <CardIcon name={p.icon as CardIconName} />
              <div>
                <h3 className="text-xl font-bold">{p.title}</h3>
                <p className="mt-1 max-w-[44ch] text-white/80">{p.body}</p>
              </div>
            </li>
          ))}
          <li>
            <Link
              href="/safety"
              className="inline-flex min-h-12 items-center rounded-full bg-yellow-400 px-6 font-semibold text-ink-950"
            >
              {copy.safe.more}
            </Link>
          </li>
        </ul>
      </div>
      <div className="order-first md:order-2 md:h-full">
        <AnimatedArt
          id="scene-moderators"
          alt="A moderator with a shield badge at a table with a mute button and a list of logged actions, with two members beside them"
          width={720}
          height={576}
          className="h-auto w-full rounded-hero bg-surface object-cover md:h-full"
        />
      </div>
    </div>
  );
}

// ---------- Nigerian data ----------

/** A network strength control that changes the call UI between video and audio only. */
export function DataSlider() {
  const [level, setLevel] = useState("4");
  const n = Number(level);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 md:gap-16">
      <div className="flex flex-col justify-center md:order-1">
        <CardIcon name="speed" className="mb-5 hidden md:inline-flex" />
        <h2
          id="data-h"
          className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em]"
        >
          {copy.data.title}
        </h2>
        <p className="mt-4 max-w-[48ch] text-lg text-text-muted">{copy.data.lead}</p>
        <div className="mt-8">
          <SegmentedTabs
            label={copy.data.sliderLabel}
            value={level}
            onChange={setLevel}
            options={copy.data.levels.map((l) => ({ value: l.value, label: l.label }))}
            className="w-full"
            optionClassName="flex-1 truncate max-sm:px-1 max-sm:text-xs"
          />
          <p role="status" aria-live="polite" className="mt-4 text-xl font-bold">
            {n <= 2 ? copy.data.weak : copy.data.strong}
          </p>
        </div>
        <AuthLink
          to={cta.enter}
          className={buttonStyles(
            "accent",
            "mt-8 min-h-12 w-fit min-w-[11rem] justify-center px-8 text-base",
          )}
        />
      </div>
      <div className="order-first flex justify-start md:order-2 md:justify-center">
        <PhoneFrame>
          <DataScreen level={n} />
        </PhoneFrame>
      </div>
    </div>
  );
}

// ---------- Final call to action ----------

const FINAL_PEOPLE: DemoPerson[] = ["Ada", "Emeka", "Zainab", "Tunde"];

/** The last word on the page: a live demo badge, the people already inside and a soundwave under it all. */
export function FinalCta() {
  const calm = useCalm();
  return (
    <div className="relative mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-20 pb-24 md:grid-cols-2 md:py-28 md:pb-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end gap-[3px] opacity-40"
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
      <div className="relative flex flex-col items-start justify-center gap-6 md:order-1">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-semibold">
          <span className="relative flex size-2.5">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-yellow-400"
              animate={calm ? undefined : { scale: [1, 2.2], opacity: [0.8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="relative size-2.5 rounded-full bg-yellow-400" />
          </span>
          {copy.final.live}
        </span>
        <h2
          id="final-h"
          className="max-w-[14ch] text-[clamp(2.5rem,6vw,4.25rem)] font-black leading-[1.02] tracking-[-0.035em]"
        >
          {copy.final.title}
        </h2>
        <p className="max-w-[44ch] text-lg text-white/90">{copy.final.body}</p>
        <div className="flex flex-wrap gap-3">
          <HeroActions primary={cta.enter} secondary={cta.rooms} />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex -space-x-3">
            {FINAL_PEOPLE.map((name, i) => (
              <PersonAvatar
                key={name}
                name={name}
                size={44}
                ring={i === 0}
                className="rounded-full ring-2 ring-green-700"
              />
            ))}
          </span>
          <span className="text-sm font-semibold text-white">{copy.final.people}</span>
        </div>
      </div>
      <div className="relative order-first md:order-2">
        <AnimatedArt
          id="scene-final-cta"
          alt="Friends waving you in around a glowing circle of sound"
          width={720}
          height={576}
          className="h-auto w-full rounded-hero object-cover object-left md:h-full"
        />
        <motion.span
          aria-hidden
          className="absolute left-5 top-5 flex size-11 items-center justify-center rounded-full bg-white text-green-700 shadow-lift"
          animate={calm ? undefined : { y: [0, -8, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Mic className="size-5" />
        </motion.span>
        <motion.span
          aria-hidden
          className="absolute bottom-5 right-5 flex size-11 items-center justify-center rounded-full bg-yellow-400 text-ink-950 shadow-lift"
          animate={calm ? undefined : { y: [0, -10, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        >
          <Hand className="size-5" />
        </motion.span>
      </div>
    </div>
  );
}
