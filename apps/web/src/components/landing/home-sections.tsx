"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Hand, Mic, MicOff, Video, Phone, Search, Star, Check } from "lucide-react";
import {
  DEMO_PEOPLE,
  TOPICS,
  type DemoPerson,
  type ReactionDto,
  type TopicInfo,
} from "@gistroom/shared";
import { ReactionChips } from "@/components/chat/reaction-chips";
import { ComposerDemo } from "@/components/mock/composer-demo";
import { PhoneFrame } from "@/components/mock/phone";
import {
  AudioCallScreen,
  ChatScreen,
  DataScreen,
  PersonAvatar,
  RoomScreen,
  VideoCallScreen,
} from "@/components/mock/screens";
import { LitRoom, PitchPhoto, StreetPhoto } from "@/components/mock/scenes";
import { AnimatedArt } from "@/components/public/animated-art";
import { CardIcon, type CardIconName } from "@/components/public/card-icon";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { homeCopy as copy } from "@/content/home";
import { mockLabels as L, roomsSearch } from "@/content/marketing";
import { useCalm } from "@/lib/calm";
import { cn } from "@/lib/cn";

/** The step nearest the middle of the screen. Each item registers its element with attach(i). */
function useActiveStep() {
  const [active, setActive] = useState(0);
  const items = useRef(new Map<number, Element>());
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const [i, el] of items.current) if (el === e.target) setActive(i);
        }
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    observer.current = io;
    for (const el of items.current.values()) io.observe(el);
    return () => io.disconnect();
  }, []);
  const attach = (i: number) => (el: Element | null) => {
    if (el) {
      items.current.set(i, el);
      observer.current?.observe(el);
    } else items.current.delete(i);
  };
  return { active, attach };
}

// ---------- Topics strip ----------

/** Two drifting rows of topic chips moving in opposite directions. Pauses on hover and off screen, and holds still for reduced motion. */
export function TopicsStrip() {
  const calm = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [hover, setHover] = useState(false);
  const run = inView && !hover && !calm;
  const mid = Math.ceil(TOPICS.length / 2);
  const rows = [TOPICS.slice(0, mid), TOPICS.slice(mid)];
  const row = (topics: readonly TopicInfo[], hidden: boolean) =>
    topics.map((t) => (
      <Link
        key={`${hidden}-${t.slug}`}
        href={`/topics/${t.slug}`}
        tabIndex={hidden ? -1 : undefined}
        aria-hidden={hidden || undefined}
        className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold text-text hover:border-green-600 hover:text-green-700"
      >
        {t.name}
      </Link>
    ));
  return (
    <div
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="flex flex-col gap-3 overflow-hidden"
      aria-label={copy.topics.label}
    >
      {rows.map((topics, i) => (
        <motion.div
          key={i}
          className="flex w-max gap-3"
          animate={run ? { x: i === 0 ? ["0%", "-50%"] : ["-50%", "0%"] } : undefined}
          transition={{ duration: 70, ease: "linear", repeat: Infinity }}
        >
          <div className="flex shrink-0 gap-3">{row(topics, false)}</div>
          <div className="flex shrink-0 gap-3" aria-hidden>
            {row(topics, true)}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** The same big search box as /rooms. From the landing page it carries the query over to the rooms page. */
export function RoomSearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/rooms?q=${encodeURIComponent(term)}` : "/rooms");
      }}
      className={cn("relative", className)}
    >
      <label htmlFor="topics-search" className="sr-only">
        {roomsSearch.label}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-text-muted"
      />
      <input
        id="topics-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={roomsSearch.placeholder}
        className="min-h-16 w-full rounded-full border-2 border-border bg-surface pl-14 pr-6 text-lg text-text shadow-soft placeholder:text-text-muted focus-visible:border-green-600"
      />
    </form>
  );
}

// ---------- How it works ----------

function CodeScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-sm font-semibold">Confirm your email</p>
      <div className="flex gap-1.5">
        {["4", "8", "2", "1", "9", "3"].map((d, i) => (
          <span
            key={i}
            className="tabular flex h-10 w-8 items-center justify-center rounded-input border border-border bg-surface-2 text-lg font-bold"
          >
            {d}
          </span>
        ))}
      </div>
      <span className="rounded-full bg-green-600 px-6 py-2 text-sm font-semibold text-white">
        Confirm
      </span>
    </div>
  );
}

function FindScreen() {
  const found: { name: DemoPerson; handle: string; action: string }[] = [
    { name: "Ada", handle: "ada_b", action: "Add friend" },
    { name: "Emeka", handle: "emeka", action: "Request sent" },
    { name: "Zainab", handle: "zee", action: "Message" },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3">
      <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-2 text-sm text-text-muted">
        <Search aria-hidden className="size-4" />
        ada
      </div>
      {found.map((f) => (
        <div key={f.name} className="flex items-center gap-2.5">
          <PersonAvatar name={f.name} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{f.name}</span>
            <span className="block text-xs text-text-muted">@{f.handle}</span>
          </span>
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-[0.6875rem] font-semibold text-green-700">
            {f.action}
          </span>
        </div>
      ))}
    </div>
  );
}

const STEP_SCREENS = [CodeScreen, FindScreen, RoomScreen, ChatScreen] as const;

/** A sticky storyboard: the phone on the right changes as each step scrolls past. Stacked on phones. */
export function HowItWorks() {
  const calm = useCalm();
  const { active, attach } = useActiveStep();
  const total = copy.how.steps.length;
  const Screen = STEP_SCREENS[active] ?? CodeScreen;
  return (
    <div className="grid gap-10 md:grid-cols-[1fr_auto] md:gap-20">
      <ol className="flex flex-col gap-6 md:gap-[22vh] md:py-10">
        {copy.how.steps.map((step, i) => {
          const Mini = STEP_SCREENS[i] ?? CodeScreen;
          return (
            <li
              key={step.title}
              ref={attach(i)}
              aria-current={active === i ? "step" : undefined}
              className={cn(
                "rounded-card border-2 p-6 transition-colors md:border-transparent md:p-0",
                active === i ? "border-yellow-400" : "border-white/15",
              )}
            >
              <span className="tabular flex size-11 items-center justify-center rounded-full bg-yellow-400 text-xl font-black text-ink-950">
                {i + 1}
              </span>
              <h3 className="mt-4 text-[clamp(1.5rem,3vw,2.25rem)] font-bold tracking-[-0.02em]">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[44ch] text-lg text-white/85">{step.body}</p>
              <p className="sr-only">{copy.how.stepLabel(i + 1, total)}</p>
              <div className="mt-6 flex justify-center md:hidden">
                <PhoneFrame>
                  <Mini />
                </PhoneFrame>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="hidden md:block">
        <div className="sticky top-28">
          <PhoneFrame>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                className="flex min-h-0 flex-1 flex-col"
                initial={calm ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={calm ? { opacity: 0 } : { opacity: 0, y: -14 }}
                transition={{ duration: 0.28 }}
              >
                <Screen />
              </motion.div>
            </AnimatePresence>
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}

// ---------- Try a room ----------

const ROOM_PEOPLE: DemoPerson[] = ["Chidi", "Ngozi", "Bayo", "Kemi", "Musa", "Funke"];
const BURST = ["\u{1F44F}", "\u{1F525}", "\u{1F602}", "\u{2764}\u{FE0F}", "\u{1F64C}"];

/** A pretend room you can play with. Nothing here is real audio, video or people. */
export function TryRoom() {
  const calm = useCalm();
  const [speaking, setSpeaking] = useState<Set<DemoPerson>>(new Set(["Chidi"]));
  const [hand, setHand] = useState(false);
  const [view, setView] = useState("audio");
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const counter = useRef(0);

  function toggle(name: DemoPerson) {
    setSpeaking((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function react() {
    const batch = Array.from({ length: 6 }, () => ({
      id: counter.current++,
      emoji: BURST[Math.floor(Math.random() * BURST.length)] ?? BURST[0]!,
      x: 10 + Math.random() * 80,
    }));
    setBursts((b) => [...b, ...batch]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => !batch.includes(x))), 2200);
  }

  return (
    <div className="mx-auto w-full max-w-3xl rounded-hero bg-surface p-4 text-text shadow-lift md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold">
            Jollof or no jollof
            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-ink-950">
              {copy.tryRoom.live}
            </span>
          </p>
          <p className="text-sm text-text-muted">{copy.tryRoom.sample}</p>
        </div>
        <SegmentedTabs
          label={copy.tryRoom.view}
          value={view}
          onChange={setView}
          options={[
            { value: "audio", label: copy.tryRoom.audio },
            { value: "video", label: copy.tryRoom.video },
          ]}
        />
      </div>
      <ul className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ROOM_PEOPLE.map((name, i) => {
          const on = speaking.has(name);
          const video = view === "video";
          return (
            <li key={name}>
              <button
                type="button"
                onClick={() => toggle(name)}
                aria-pressed={on}
                aria-label={on ? copy.tryRoom.mute(name) : copy.tryRoom.unmute(name)}
                className="relative flex w-full flex-col items-center gap-2 overflow-hidden rounded-card bg-surface-2 p-4 transition-all hover:bg-green-100"
                style={{ minHeight: video ? "11rem" : "9rem" }}
              >
                {video ? (
                  <span className="absolute inset-0">
                    <LitRoom className="size-full" />
                    <Image
                      src={`/images/people/person-${String(DEMO_PEOPLE.indexOf(name) + 1).padStart(2, "0")}.png`}
                      alt=""
                      fill
                      sizes="200px"
                      className="object-contain object-bottom p-2"
                    />
                  </span>
                ) : (
                  <PersonAvatar name={name} size={72} ring={on} />
                )}
                <span
                  className={cn(
                    "relative z-10 mt-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
                    video ? "bg-ink-950/70 text-white" : "text-text",
                  )}
                >
                  {on ? (
                    <Mic aria-hidden className="size-3.5 text-green-600" />
                  ) : (
                    <MicOff aria-hidden className="size-3.5 text-text-muted" />
                  )}
                  {name}
                  {i === 0 ? ` (${L.host})` : ""}
                </span>
                {on ? (
                  <span aria-hidden className="absolute right-3 top-3 flex h-4 items-end gap-[2px]">
                    {[0, 1, 2, 3].map((b) => (
                      <motion.span
                        key={b}
                        className="w-[3px] origin-bottom rounded-full bg-green-600"
                        style={{ height: "100%" }}
                        animate={calm ? { scaleY: 0.7 } : { scaleY: [0.3, 1, 0.5] }}
                        transition={{ duration: 0.7, repeat: Infinity, delay: b * 0.1 }}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        <AnimatePresence>
          {bursts.map((b) => (
            <motion.span
              key={b.id}
              aria-hidden
              initial={{ opacity: 1, y: 0, scale: 0.6 }}
              animate={calm ? { opacity: 0 } : { opacity: 0, y: -140, scale: 1.3 }}
              transition={{ duration: 2 }}
              className="pointer-events-none absolute bottom-0 text-3xl"
              style={{ left: `${b.x}%` }}
            >
              {b.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          aria-pressed={hand}
          onClick={() => setHand((h) => !h)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold",
            hand ? "bg-yellow-400 text-ink-950" : "bg-surface-2 text-text",
          )}
        >
          <Hand aria-hidden className="size-5" />
          {hand ? copy.tryRoom.lower : copy.tryRoom.raise}
        </button>
        <button
          type="button"
          onClick={react}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-green-600 px-5 font-semibold text-white"
        >
          {BURST[0]}
          <span>{copy.tryRoom.react}</span>
        </button>
      </div>
    </div>
  );
}

// ---------- Calls that switch ----------

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
    <div ref={ref} className="flex flex-col items-center gap-5">
      <PhoneFrame tone="light" label={video ? L.video : L.audio}>
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
      <button
        type="button"
        aria-pressed={video}
        onClick={() => setVideo((v) => !v)}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-yellow-400 px-6 font-semibold text-ink-950"
      >
        {video ? (
          <Phone aria-hidden className="size-5" />
        ) : (
          <Video aria-hidden className="size-5" />
        )}
        {video ? "Back to audio" : "Add video"}
      </button>
    </div>
  );
}

// ---------- Everywhere ----------

/** A scene story: the picture changes as each time of day scrolls past. Stacked, with a picture each, on phones. */
export function Everywhere() {
  const { active, attach } = useActiveStep();
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <div className="hidden md:block">
        <div className="sticky top-28 aspect-square">
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
                <AnimatedArt id={c.id} alt={c.alt} width={720} height={720} className="size-full" />
              ) : null}
            </div>
          ))}
          <span className="tabular absolute bottom-4 left-4 z-10 rounded-full bg-ink-950/75 px-4 py-1.5 text-sm font-semibold text-white">
            {copy.everywhere.progress(active + 1, copy.everywhere.chapters.length)}
          </span>
        </div>
      </div>
      <ol className="flex flex-col gap-12 md:gap-[34vh] md:py-16">
        {copy.everywhere.chapters.map((c, i) => (
          <li key={c.id} ref={attach(i)} aria-current={active === i ? "step" : undefined}>
            <div className="mb-5 aspect-square max-w-sm md:hidden">
              <AnimatedArt id={c.id} alt={c.alt} width={720} height={720} className="size-full" />
            </div>
            <p className="flex items-center gap-3 text-sm font-bold text-green-700">
              <span className="tabular flex size-8 items-center justify-center rounded-full bg-yellow-400 text-ink-950">
                {i + 1}
              </span>
              {c.time}
            </p>
            <h3 className="mt-1 text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em]">
              {c.title}
            </h3>
            <p className="mt-3 max-w-[46ch] text-lg text-text-muted">{c.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- Chat bento ----------

const REACTS: ReactionDto[] = [
  { emoji: "\u{1F44D}", count: 1, mine: false },
  { emoji: "\u{1F525}", count: 2, mine: true },
];

export function ChatBento() {
  const c = copy.chat;
  return (
    <ul className="grid gap-4 md:grid-cols-4 md:grid-rows-2">
      <li className="rounded-card bg-green-600 p-6 text-white md:col-span-2">
        <h3 className="text-xl font-bold">{c.voice.title}</h3>
        <p className="mt-1 text-white/85">{c.voice.body}</p>
        <div className="mt-5 flex items-center gap-3 rounded-full bg-white/15 p-2 pr-4">
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-green-700">
            <Mic aria-hidden className="size-5" />
          </span>
          <span aria-hidden className="flex h-8 flex-1 items-center gap-[3px]">
            {Array.from({ length: 34 }, (_, i) => (
              <motion.span
                key={i}
                className="w-[3px] origin-center rounded-full bg-white/85"
                style={{ height: `${25 + ((i * 37) % 70)}%` }}
                animate={{ scaleY: [1, 0.5 + (i % 4) * 0.15, 1] }}
                transition={{ duration: 1 + (i % 5) * 0.15, repeat: Infinity, delay: i * 0.03 }}
              />
            ))}
          </span>
          <span className="tabular text-sm">0:14</span>
        </div>
      </li>
      <li className="rounded-card bg-surface p-6 shadow-soft md:row-span-2">
        <h3 className="text-xl font-bold">{c.media.title}</h3>
        <p className="mt-1 text-text-muted">{c.media.body}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <StreetPhoto className="aspect-[4/3] w-full rounded-lg" />
          <PitchPhoto className="aspect-[4/3] w-full rounded-lg" />
          <div className="col-span-2 flex items-center gap-3 rounded-lg bg-surface-2 p-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-danger-600 text-white">
              <Check aria-hidden className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{c.fileName}</span>
              <span className="tabular block text-xs text-text-muted">{c.fileMeta}</span>
            </span>
          </div>
        </div>
      </li>
      <li className="rounded-card bg-yellow-100 p-6 text-ink-950">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Star aria-hidden className="size-5 fill-current" />
          {c.starred.title}
        </h3>
        <p className="mt-1">{c.starred.body}</p>
        <p className="mt-4 rounded-bubble rounded-bl-[4px] bg-white px-3 py-2 text-sm">
          {c.starredSample}
        </p>
      </li>
      <li className="rounded-card bg-surface p-6 shadow-soft">
        <h3 className="text-xl font-bold">{c.reactions.title}</h3>
        <p className="mt-1 text-text-muted">{c.reactions.body}</p>
        <div className="mt-4 inline-block rounded-bubble rounded-br-[4px] bg-green-600 px-3 py-2 text-sm text-white">
          Ah, I screamed. We move!
        </div>
        <ReactionChips reactions={REACTS} className="mt-1" />
      </li>
      <li className="rounded-card bg-ink-950 p-6 text-white md:col-span-2">
        <h3 className="text-xl font-bold">{c.bubbles.title}</h3>
        <p className="mt-1 text-white/80">{c.bubbles.body}</p>
        <div className="mt-4 flex flex-col gap-2">
          <p className="max-w-[80%] rounded-bubble rounded-bl-[4px] bg-white/10 px-3 py-2 text-sm">
            You dey come tonight?
            <span className="tabular ml-2 text-xs opacity-70">7:12</span>
          </p>
          <p className="max-w-[80%] self-end rounded-bubble rounded-br-[4px] bg-green-600 px-3 py-2 text-sm">
            Oya, I am on my way.
            <span className="tabular ml-2 text-xs opacity-80">7:13</span>
          </p>
        </div>
      </li>
      <li className="md:col-span-4">
        <ComposerDemo className="rounded-full border border-border" />
      </li>
    </ul>
  );
}

// ---------- Safe by design ----------

export function SafeByDesign() {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <ul className="flex flex-col gap-6">
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
      <AnimatedArt
        id="scene-moderators"
        alt="A moderator with a shield badge at a table with a mute button and a list of logged actions, with two members beside them"
        width={720}
        height={576}
        className="h-auto w-full rounded-hero bg-surface"
      />
    </div>
  );
}

// ---------- Nigerian data ----------

/** A network strength control that changes the call UI between video and audio only. */
export function DataSlider() {
  const [level, setLevel] = useState("4");
  const n = Number(level);
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div>
        <SegmentedTabs
          label={copy.data.sliderLabel}
          value={level}
          onChange={setLevel}
          options={copy.data.levels.map((l) => ({ value: l.value, label: l.label }))}
        />
        <p role="status" aria-live="polite" className="mt-4 text-xl font-bold">
          {n <= 2 ? copy.data.weak : copy.data.strong}
        </p>
      </div>
      <div className="flex justify-center">
        <PhoneFrame>
          <DataScreen level={n} />
        </PhoneFrame>
      </div>
    </div>
  );
}
