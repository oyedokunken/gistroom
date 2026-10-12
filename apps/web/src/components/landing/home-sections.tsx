"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ArrowUpRight,
  AudioLines,
  Clock,
  Hand,
  Images,
  Mic,
  MicOff,
  NotebookPen,
  Paperclip,
  Pause,
  Play,
  Phone,
  Search,
  SendHorizontal,
  Settings,
  SignalLow,
  Smile,
  SmilePlus,
  Square,
  Star,
  Video,
  X,
  Check,
} from "lucide-react";
import {
  DEMO_PEOPLE,
  TOPICS,
  type DemoPerson,
  type ReactionDto,
  type TopicInfo,
} from "@gistroom/shared";
import { ReactionChips } from "@/components/chat/reaction-chips";
import { AndroidStatusBar, PhoneFrame, SamsungNavBar } from "@/components/mock/phone";
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
import { HeroActions } from "@/components/public/sections";
import { buttonStyles } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { chat } from "@/content/chat";
import { homeCopy as copy } from "@/content/home";
import { cta, mockLabels as L, roomsSearch } from "@/content/marketing";
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
      className="relative left-1/2 flex w-screen -translate-x-1/2 flex-col gap-3 overflow-hidden"
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

// ---------- Live topic cards ----------

/** A fresh custom icon for every topic, drawn by scripts/graphics/icons.mjs. */
const TOPIC_CARD_ICONS: Record<string, CardIconName> = Object.fromEntries(
  TOPICS.map((t) => [t.slug, t.icon as CardIconName]),
);

/**
 * Two drifting rows of demo topic cards moving in opposite directions, edge to edge.
 * Each card has a custom icon and a button into its topic page. Pauses on hover and off screen.
 */
export function TopicCardsMarquee() {
  const calm = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [hover, setHover] = useState(false);
  const run = inView && !hover && !calm;
  const mid = Math.ceil(TOPICS.length / 2);
  const rows = [TOPICS.slice(0, mid), TOPICS.slice(mid)];
  const card = (t: TopicInfo, hidden: boolean) => {
    return (
      <div
        key={`${hidden}-${t.slug}`}
        className="group w-72 shrink-0 rounded-card bg-surface p-5 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
      >
        <CardIcon name={TOPIC_CARD_ICONS[t.slug] ?? "open-gist"} className="size-12" />
        <p className="mt-4 font-bold">{t.name}</p>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm text-text-muted">{t.description}</p>
        <Link
          href={`/topics/${t.slug}`}
          tabIndex={hidden ? -1 : undefined}
          aria-hidden={hidden || undefined}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-green-600 px-5 text-sm font-semibold text-white transition-colors group-hover:bg-yellow-400 group-hover:text-ink-950"
        >
          {copy.discover.open}
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    );
  };
  return (
    <div
      ref={ref}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="relative left-1/2 flex w-screen -translate-x-1/2 flex-col gap-4 overflow-hidden py-4"
      aria-label={copy.discover.label}
    >
      {rows.map((topics, i) => (
        <motion.div
          key={i}
          className="flex w-max gap-4 px-4"
          animate={run ? { x: i === 0 ? ["0%", "-50%"] : ["-50%", "0%"] } : undefined}
          transition={{ duration: 90, ease: "linear", repeat: Infinity }}
        >
          <div className="flex shrink-0 gap-4">{topics.map((t) => card(t, false))}</div>
          <div className="flex shrink-0 gap-4" aria-hidden>
            {topics.map((t) => card(t, true))}
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

/** An accordion of the four steps: collapsed strips grow into a card with the screen, the words and a button. */
export function HowItWorks() {
  const calm = useCalm();
  const [open, setOpen] = useState(0);
  const total = copy.how.steps.length;
  return (
    <ol className="flex flex-col gap-4 md:h-[680px] md:flex-row">
      {copy.how.steps.map((step, i) => {
        const Mini = STEP_SCREENS[i] ?? CodeScreen;
        const isOpen = open === i;
        return (
          <li
            key={step.title}
            aria-current={isOpen ? "step" : undefined}
            className={cn(
              "overflow-hidden rounded-card border-2 transition-all duration-500 ease-out",
              isOpen
                ? "border-white bg-white md:flex-[4]"
                : "group/step border-yellow-400 bg-yellow-400 hover:border-white/40 hover:bg-transparent focus-within:border-white/40 focus-within:bg-transparent md:flex-[1]",
            )}
          >
            {isOpen ? (
              <div className="relative flex h-full flex-col gap-4 p-5 md:p-7">
                <span className="tabular absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-yellow-400 text-xl font-black text-ink-950 md:right-7 md:top-7">
                  {i + 1}
                </span>
                <div className="flex h-[380px] min-h-0 items-stretch justify-start md:h-auto md:flex-1">
                  <motion.div
                    initial={calm ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex aspect-[9/19] h-full flex-col overflow-hidden rounded-[1.9rem] border-[7px] border-ink-950 bg-surface text-text ring-1 ring-ink-700"
                  >
                    <AndroidStatusBar tone="dark" />
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden [container-type:size]">
                      <div className="flex h-[470px] w-[270px] origin-top-left scale-[calc(100cqw/270px)] flex-col">
                        <Mini />
                      </div>
                    </div>
                    <SamsungNavBar tone="dark" />
                  </motion.div>
                </div>
                <p className="sr-only">{copy.how.stepLabel(i + 1, total)}</p>
                <div>
                  <h3 className="text-[clamp(1.4rem,2.4vw,2rem)] font-bold tracking-[-0.02em] text-ink-950">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[46ch] text-text-muted">{step.body}</p>
                  <Link
                    href={step.cta.href}
                    className={buttonStyles("accent", "mt-4 min-h-11 px-6")}
                  >
                    {step.cta.label}
                    <ArrowUpRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-expanded={false}
                className="flex h-16 w-full items-center gap-4 px-5 text-left md:h-full md:flex-col md:gap-6 md:px-0 md:py-6"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-ink-950/30 text-ink-950 transition-colors group-hover/step:border-white/40 group-hover/step:text-white group-focus-within/step:border-white/40 group-focus-within/step:text-white md:order-1"
                >
                  <ArrowUpRight className="size-4" />
                </span>
                <span className="flex-1 text-lg font-bold tracking-[-0.02em] text-ink-950 transition-colors group-hover/step:text-white group-focus-within/step:text-white md:order-2 md:my-auto md:rotate-180 md:text-[clamp(1.4rem,2.4vw,2rem)] md:[writing-mode:vertical-rl]">
                  {step.title}
                </span>
                <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-950 text-sm font-black text-yellow-400 md:order-3 md:-rotate-90">
                  {i + 1}
                </span>
                <span className="sr-only">{copy.how.stepLabel(i + 1, total)}</span>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Try a room ----------

const ROOM_PEOPLE: DemoPerson[] = ["Chidi", "Ngozi", "Bayo", "Kemi", "Musa", "Funke"];
const BURST = ["\u{1F44F}", "\u{1F525}", "\u{1F602}", "\u{2764}\u{FE0F}", "\u{1F64C}"];
const ROOM_LEVELS = [4, 3, 4, 2, 4, 3];

/** Little signal bars on each card, like the network strength a call would see. */
function RoomNetBars({ level, video }: { level: number; video: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-3 top-3 flex items-end gap-[2px] rounded-full px-1.5 py-1",
        video && "bg-ink-950/70",
      )}
    >
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={cn(
            "w-[2.5px] rounded-[1px]",
            b <= level
              ? video
                ? "bg-green-400"
                : "bg-green-600"
              : video
                ? "bg-white/30"
                : "bg-text-muted/40",
          )}
          style={{ height: `${b * 3 + 1}px` }}
        />
      ))}
    </span>
  );
}

/** A pretend room you can play with. Nothing here is real audio, video or people. */
export function TryRoom() {
  const calm = useCalm();
  const [speaking, setSpeaking] = useState<Set<DemoPerson>>(new Set(["Chidi"]));
  const [hand, setHand] = useState(false);
  const [view, setView] = useState("audio");
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [notes, setNotes] = useState<{ id: number; text: string; time: string }[]>([]);
  const [noting, setNoting] = useState(false);
  const [draft, setDraft] = useState("");
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
  function saveNote() {
    const text = draft.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setNotes((n) => [...n, { id: counter.current++, text, time }]);
    setDraft("");
  }

  return (
    <div className="w-full rounded-hero bg-surface p-4 text-text shadow-lift md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold">
            {copy.tryRoom.roomName}
            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-ink-950">
              {copy.tryRoom.live}
            </span>
          </p>
        </div>
        <SegmentedTabs
          label={copy.tryRoom.view}
          value={view}
          onChange={(v) => {
            setView(v);
            if (v === "audio") setHand(false);
          }}
          options={[
            { value: "audio", label: copy.tryRoom.audio },
            { value: "video", label: copy.tryRoom.video },
          ]}
        />
      </div>
      <div className="mt-5 flex flex-col gap-4 md:flex-row-reverse">
        <AnimatePresence initial={false}>
          {noting ? (
            <motion.aside
              key="notes-panel"
              aria-label={copy.tryRoom.notesTitle}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.25 }}
              className="flex w-full shrink-0 flex-col overflow-hidden rounded-card border border-border bg-surface-2 md:w-72"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold leading-tight">{copy.tryRoom.roomName}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {copy.tryRoom.inCall(ROOM_PEOPLE.length)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    role="img"
                    aria-label={copy.tryRoom.settings}
                    className="flex size-8 items-center justify-center rounded-full text-text-muted"
                  >
                    <Settings aria-hidden className="size-4" />
                  </span>
                  <button
                    type="button"
                    aria-label={copy.tryRoom.notesClose}
                    onClick={() => setNoting(false)}
                    className="flex size-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              </div>
              <div className="flex max-h-60 min-h-28 flex-1 flex-col gap-2 overflow-y-auto p-4 md:max-h-none">
                {notes.length === 0 ? (
                  <p className="text-sm text-text-muted">{copy.tryRoom.notesEmpty}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                      {notes.map((n, i) => (
                        <motion.li
                          key={n.id}
                          layout
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1, rotate: i % 2 === 0 ? -1 : 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 400, damping: 26 }}
                          className="rounded-lg bg-yellow-100 py-2 pl-3 pr-1.5 text-sm font-medium text-ink-950 shadow-soft"
                        >
                          <div className="flex items-center gap-2">
                            <NotebookPen
                              aria-hidden
                              className="mt-0.5 size-4 shrink-0 self-start text-ink-950/60"
                            />
                            <span className="min-w-0 flex-1 break-words">{n.text}</span>
                            <button
                              type="button"
                              aria-label={copy.tryRoom.noteRemove}
                              onClick={() => setNotes((all) => all.filter((x) => x.id !== n.id))}
                              className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-950/60 hover:bg-ink-950/10 hover:text-ink-950"
                            >
                              <X aria-hidden className="size-3.5" />
                            </button>
                          </div>
                          <p className="tabular mt-1 pl-6 text-xs text-ink-950/50">
                            {copy.tryRoom.noteBy} · {n.time}
                          </p>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  saveNote();
                }}
                className="flex items-center gap-2 border-t border-border p-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setDraft("");
                      setNoting(false);
                    }
                  }}
                  placeholder={copy.tryRoom.notePlaceholder}
                  aria-label={copy.tryRoom.note}
                  className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-green-600 px-5 font-semibold text-white"
                >
                  {copy.tryRoom.noteSave}
                </button>
              </form>
            </motion.aside>
          ) : null}
        </AnimatePresence>
        <ul className={cn("relative grid flex-1 grid-cols-2 gap-3", !noting && "sm:grid-cols-3")}>
          {ROOM_PEOPLE.map((name, i) => {
            const on = speaking.has(name);
            const video = view === "video";
            const isYou = i === ROOM_PEOPLE.length - 1;
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => toggle(name)}
                  aria-pressed={on}
                  aria-label={on ? copy.tryRoom.mute(name) : copy.tryRoom.unmute(name)}
                  className="relative flex min-h-[11rem] w-full flex-col items-center gap-2 overflow-hidden rounded-card bg-surface-2 p-4 transition-all hover:bg-green-100"
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
                  <RoomNetBars level={ROOM_LEVELS[i % ROOM_LEVELS.length] ?? 4} video={video} />
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
                    {isYou ? L.you : name}
                    {i === 0 ? ` (${L.host})` : ""}
                  </span>
                  {on || (isYou && hand) ? (
                    <span className="absolute right-3 top-3 flex items-center gap-2">
                      {isYou && hand ? (
                        <motion.span
                          aria-hidden
                          animate={calm ? undefined : { rotate: [0, 14, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity }}
                          className="flex size-6 items-center justify-center rounded-full bg-yellow-400 text-ink-950"
                        >
                          <Hand className="size-3.5" />
                        </motion.span>
                      ) : null}
                      {on ? (
                        <span aria-hidden className="flex h-4 items-end gap-[2px]">
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
      </div>
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
        <button
          type="button"
          aria-pressed={noting}
          onClick={() => setNoting((v) => !v)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold",
            noting ? "bg-yellow-400 text-ink-950" : "bg-surface-2 text-text",
          )}
        >
          <NotebookPen aria-hidden className="size-5" />
          {copy.tryRoom.note}
        </button>
      </div>
    </div>
  );
}

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
        <CardIcon name="switch" className="mb-5" />
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
      <div className="order-1 flex h-full flex-col items-center justify-center md:order-2">
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

// ---------- Chat bento ----------

const REACTS: ReactionDto[] = [
  { emoji: "\u{1F44D}", count: 1, mine: false },
  { emoji: "\u{1F525}", count: 2, mine: true },
];
const EXTRA_REACTS = ["\u{1F602}", "\u{2764}\u{FE0F}", "\u{1F44F}"];

export function ChatBento() {
  const calm = useCalm();
  const c = copy.chat;
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!recording && !playing) return;
    const limit = recording ? 14 : 23;
    const id = window.setInterval(() => {
      setSec((s) => {
        if (s + 1 >= limit) {
          setRecording(false);
          setPlaying(false);
          return 0;
        }
        return s + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [recording, playing]);
  const toggleRec = () => {
    setRecording((r) => !r);
    setPlaying(false);
    setSec(0);
  };
  const togglePlay = () => {
    setPlaying((p) => !p);
    setRecording(false);
    setSec(0);
  };
  const fmt = (s: number) => `0:${String(s).padStart(2, "0")}`;
  const [reactions, setReactions] = useState<ReactionDto[]>([...REACTS]);
  const [draft, setDraft] = useState("");
  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const toggleReaction = (emoji: string) =>
    setReactions((rs) =>
      rs.flatMap((r) => {
        if (r.emoji !== emoji) return [r];
        const count = r.count + (r.mine ? -1 : 1);
        return count > 0 ? [{ ...r, mine: !r.mine, count }] : [];
      }),
    );
  const addReaction = () =>
    setReactions((rs) => {
      const next = EXTRA_REACTS.find((e) => !rs.some((r) => r.emoji === e));
      return next ? [...rs, { emoji: next, count: 1, mine: true }] : rs;
    });
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
      <li className="group rounded-card bg-green-600 p-6 text-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <AudioLines
            aria-hidden
            className="size-5 transition-transform duration-300 group-hover:scale-125"
          />
          {c.voice.title}
        </h3>
        <p className="mt-1 text-white">{c.voice.body}</p>
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-bubble rounded-bl-[4px] bg-ink-950/20 p-2 pr-4 transition-colors duration-300 group-hover:bg-ink-950/25">
            <button
              type="button"
              aria-pressed={recording}
              aria-label={recording ? c.voiceStop : c.voiceRecord}
              onClick={toggleRec}
              className={cn(
                "relative flex size-10 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                recording ? "bg-danger-600 text-white" : "bg-white text-green-700",
              )}
            >
              {recording ? (
                <>
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-danger-600"
                    animate={calm ? undefined : { scale: [1, 1.45], opacity: [0.6, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                  />
                  <Square aria-hidden className="relative size-3.5 fill-current" />
                </>
              ) : (
                <Mic aria-hidden className="size-5" />
              )}
            </button>
            <span
              aria-hidden
              className="flex h-8 min-w-0 flex-1 items-center gap-[3px] overflow-hidden"
            >
              {Array.from({ length: 34 }, (_, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] origin-center rounded-full bg-white/85"
                  style={{ height: `${25 + ((i * 37) % 70)}%` }}
                  animate={
                    recording && !calm ? { scaleY: [1, 0.5 + (i % 4) * 0.15, 1] } : { scaleY: 1 }
                  }
                  transition={{ duration: 1 + (i % 5) * 0.15, repeat: Infinity, delay: i * 0.03 }}
                />
              ))}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="tabular text-sm">{recording ? fmt(sec) : c.voiceLenA}</span>
              <span className="tabular text-xs text-white">{c.voiceTimeA}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 self-end rounded-bubble rounded-br-[4px] bg-white p-2 pr-4 text-green-700">
            <button
              type="button"
              aria-pressed={playing}
              aria-label={playing ? c.voicePause : c.voicePlay}
              onClick={togglePlay}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-transform duration-300 hover:scale-110 group-hover:scale-110"
            >
              {playing ? (
                <Pause aria-hidden className="size-4 fill-current" />
              ) : (
                <Play aria-hidden className="size-4 translate-x-[1px] fill-current" />
              )}
            </button>
            <span aria-hidden className="flex h-8 min-w-0 items-center gap-[3px] overflow-hidden">
              {Array.from({ length: 34 }, (_, i) => (
                <motion.span
                  key={i}
                  className="w-[3px] origin-center rounded-full bg-green-600/80"
                  style={{ height: `${25 + ((i * 53) % 65)}%` }}
                  animate={
                    playing && !calm ? { scaleY: [1, 0.4 + (i % 5) * 0.12, 1] } : { scaleY: 1 }
                  }
                  transition={{ duration: 0.8 + (i % 4) * 0.12, repeat: Infinity, delay: i * 0.02 }}
                />
              ))}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="tabular text-sm">{playing ? fmt(sec) : c.voiceLenB}</span>
              <span className="tabular text-xs text-text-muted">{c.voiceTimeB}</span>
            </span>
          </div>
        </div>
      </li>
      <li className="group rounded-card bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Images
            aria-hidden
            className="size-5 text-green-700 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
          />
          {c.media.title}
        </h3>
        <p className="mt-1 text-text-muted">{c.media.body}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="overflow-hidden rounded-lg">
            <StreetPhoto className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="overflow-hidden rounded-lg">
            <PitchPhoto className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-110" />
          </div>
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
      <li className="group rounded-card bg-yellow-100 p-6 text-ink-950 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Star
            aria-hidden
            className="size-5 fill-current transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125"
          />
          {c.starred.title}
        </h3>
        <p className="mt-1">{c.starred.body}</p>
        <div className="mt-4 flex flex-col gap-2.5">
          <p className="relative w-fit rounded-bubble rounded-bl-[4px] bg-white px-3 py-2 text-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            {c.starredSample}
            <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-yellow-400 ring-2 ring-yellow-100">
              <Star aria-hidden className="size-3 fill-ink-950 text-ink-950" />
            </span>
          </p>
          <p className="w-fit self-end rounded-bubble rounded-br-[4px] bg-green-600 px-3 py-2 text-sm text-white transition-transform duration-300 group-hover:-translate-y-0.5">
            {c.starredSample2}
          </p>
          <p className="w-fit rounded-bubble rounded-bl-[4px] bg-white px-3 py-2 text-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            {c.starredSample3}
          </p>
          <p className="w-fit self-end rounded-bubble rounded-br-[4px] bg-white px-3 py-2 text-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            {c.starredSample4}
          </p>
        </div>
      </li>
      <li className="group rounded-card bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <SmilePlus
            aria-hidden
            className="size-5 text-green-700 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125"
          />
          {c.reactions.title}
        </h3>
        <p className="mt-1 text-text-muted">{c.reactions.body}</p>
        <div className="mt-4 inline-block rounded-bubble rounded-br-[4px] bg-green-600 px-3 py-2 text-sm text-white transition-transform duration-300 group-hover:-translate-y-0.5">
          Ah, I screamed. We move!
        </div>
        <div className="mt-1 flex items-center gap-1">
          <ReactionChips reactions={reactions} onToggle={toggleReaction} />
          <button
            type="button"
            aria-label={c.addReaction}
            onClick={addReaction}
            className="inline-flex size-7 items-center justify-center rounded-full border border-dashed border-border text-text-muted transition-colors hover:border-green-600 hover:text-green-700"
          >
            <SmilePlus aria-hidden className="size-4" />
          </button>
        </div>
      </li>
      <li className="group rounded-card bg-ink-950 p-6 text-white transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <Clock
            aria-hidden
            className="size-5 transition-transform duration-500 group-hover:rotate-180"
          />
          {c.bubbles.title}
        </h3>
        <p className="mt-1 text-white/80">{c.bubbles.body}</p>
        <div className="mt-4 flex flex-col gap-2">
          <p className="max-w-[80%] rounded-bubble rounded-bl-[4px] bg-white/10 px-3 py-2 text-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            You dey come tonight?
            <span className="tabular ml-2 text-xs opacity-70">7:12</span>
          </p>
          <p className="max-w-[80%] self-end rounded-bubble rounded-br-[4px] bg-green-600 px-3 py-2 text-sm transition-transform duration-300 group-hover:translate-y-0.5">
            Oya, I am on my way.
            <span className="tabular ml-2 text-xs text-green-100">7:13</span>
          </p>
        </div>
      </li>
      <li className="group flex flex-col rounded-card bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <SendHorizontal
            aria-hidden
            className="size-5 text-green-700 transition-transform duration-300 group-hover:translate-x-1"
          />
          {c.composer.title}
        </h3>
        <p className="mt-1 text-text-muted">{c.composer.body}</p>
        {sentMsg ? (
          <p className="mt-4 w-fit max-w-full self-end break-words rounded-bubble rounded-br-[4px] bg-green-600 px-3 py-2 text-sm text-white">
            {sentMsg}
            <span className="tabular ml-2 text-xs opacity-80">{c.now}</span>
          </p>
        ) : null}
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            setSentMsg(text);
            setDraft("");
          }}
          className="mt-auto flex items-center gap-1 pt-4"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-text"
          >
            <Smile className="size-5" />
          </span>
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-text"
          >
            <Paperclip className="size-5" />
          </span>
          <label htmlFor="bento-composer" className="sr-only">
            {chat.composerPlaceholder}
          </label>
          <input
            id="bento-composer"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={chat.composerPlaceholder}
            className="min-h-9 min-w-0 flex-1 rounded-[1.375rem] bg-surface-2 px-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-green-600"
          />
          <button
            type="submit"
            aria-label={draft.trim() ? chat.send : c.voiceRecord}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition-transform duration-300 hover:scale-110"
          >
            {draft.trim() ? (
              <SendHorizontal aria-hidden className="size-4" />
            ) : (
              <Mic aria-hidden className="size-4" />
            )}
          </button>
        </form>
      </li>
    </ul>
  );
}

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
        <CardIcon name="speed" className="mb-5" />
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
        <Link
          href={cta.enter.href}
          className={buttonStyles("accent", "mt-8 min-h-12 w-fit px-8 text-base")}
        >
          {cta.enter.label}
        </Link>
      </div>
      <div className="order-first flex justify-center md:order-2">
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
