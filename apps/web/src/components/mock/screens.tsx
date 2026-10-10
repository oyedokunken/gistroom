"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import {
  BellRing,
  Check,
  CheckCheck,
  EllipsisVertical,
  Hand,
  Mic,
  MicOff,
  NotebookPen,
  Phone,
  PhoneOff,
  Play,
  RefreshCcw,
  UserPlus,
  Video,
  VideoOff,
  Wifi,
  X,
} from "lucide-react";
import { DEMO_PEOPLE, demoAvatarSrc, type DemoPerson, type ReactionDto } from "@gistroom/shared";
import { ReactionChips } from "@/components/chat/reaction-chips";
import { mockLabels as L } from "@/content/marketing";
import { cn } from "@/lib/cn";
import { ComposerDemo } from "./composer-demo";
import { PhoneFrame } from "./phone";
import { LitRoom, PitchPhoto, StreetPhoto } from "./scenes";

// Emojis are written as escapes so the source stays free of emoji (R1). Thumbs up, joy, fire, clapping hands.
const THUMB = "\u{1F44D}";
const JOY = "\u{1F602}";
const FIRE = "\u{1F525}";
const CLAP = "\u{1F44F}";

/** The face for a demo name, always the same one. */
export function PersonAvatar({
  name,
  size = 44,
  ring,
  className,
}: {
  name: DemoPerson;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={demoAvatarSrc(name)}
        alt=""
        width={size}
        height={size}
        className="size-full rounded-full object-cover"
      />
      {ring ? (
        <span
          aria-hidden
          className="absolute -inset-1 rounded-full border-[3px] border-green-600 motion-safe:animate-pulse"
        />
      ) : null}
    </span>
  );
}

/** Runs while the phone is on screen and the visitor has not asked for less motion. */
function useRunning() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  return { ref, run: inView && !reduced, reduced: Boolean(reduced) };
}

/** Seconds counting up from a start value while running. */
function useTimer(start: number, run: boolean): string {
  const [s, setS] = useState(start);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => setS((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [run]);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

const mine = (...r: [string, number][]): ReactionDto[] =>
  r.map(([emoji, count]) => ({ emoji, count, mine: false }));

function Bubble({
  me,
  children,
  time,
  reactions,
  ticks,
}: {
  me?: boolean;
  children: ReactNode;
  time: string;
  reactions?: ReactionDto[];
  ticks?: "sent" | "read";
}) {
  return (
    <div className={cn("flex flex-col", me ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-bubble px-3 py-1.5 text-[0.8125rem] leading-snug",
          me
            ? "rounded-br-[4px] bg-green-600 text-white"
            : "rounded-bl-[4px] bg-surface-2 text-text",
        )}
      >
        {children}
        <span
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[0.625rem]",
            me ? "text-green-100" : "opacity-80",
          )}
        >
          <span className="tabular">{time}</span>
          {me ? (
            ticks === "sent" ? (
              <Check aria-hidden className="size-3" />
            ) : (
              <CheckCheck aria-hidden className="size-3" />
            )
          ) : null}
        </span>
      </div>
      {reactions ? <ReactionChips reactions={reactions} className="-mt-1.5 mx-2" /> : null}
    </div>
  );
}

const WAVE = [30, 55, 40, 80, 60, 35, 70, 90, 50, 65, 40, 75, 55, 30, 60, 45, 85, 50, 35, 60];

function VoiceBubble({ run }: { run: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-green-700">
        <Play aria-hidden className="size-4" />
      </span>
      <span aria-hidden className="flex h-7 items-center gap-[2px]">
        {WAVE.map((h, i) => (
          <motion.span
            key={i}
            className="w-[3px] origin-center rounded-full bg-white/80"
            style={{ height: `${h}%` }}
            animate={run ? { scaleY: [1, 0.55 + (i % 4) * 0.2, 1] } : { scaleY: 1 }}
            transition={{ duration: 0.9 + (i % 3) * 0.2, repeat: Infinity, delay: i * 0.05 }}
          />
        ))}
      </span>
      <span className="tabular text-[0.6875rem]">0:14</span>
    </div>
  );
}

// ---------- Chat ----------

export function ChatScreen() {
  const { ref, run } = useRunning();
  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2">
        <PersonAvatar name="Ada" size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ada</p>
          <p className="text-[0.6875rem] font-medium text-green-700">{L.typing}...</p>
        </div>
        <span aria-hidden className="flex items-center gap-2 text-text-muted">
          <Video className="size-4" />
          <Phone className="size-4" />
          <EllipsisVertical className="size-4" />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-2.5 py-2">
        <Bubble time="9:38">Did you watch the match last night?</Bubble>
        <Bubble me time="9:39" reactions={mine([THUMB, 1], [FIRE, 1])}>
          Ah, I screamed. We move!
        </Bubble>
        <Bubble me time="9:40" ticks="read">
          <div className="w-44">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
              <StreetPhoto className="absolute inset-0 size-full" />
            </div>
          </div>
        </Bubble>
        <Bubble time="9:40" reactions={mine([JOY, 2])}>
          <VoiceRowLight run={run} />
        </Bubble>
        <Bubble me time="9:41" ticks="sent">
          <VoiceBubble run={run} />
        </Bubble>
        <div className="flex w-14 items-center justify-center gap-1 self-start rounded-bubble rounded-bl-[4px] bg-surface-2 py-2.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className="size-1.5 rounded-full bg-text-muted motion-safe:animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
      <ComposerDemo />
    </div>
  );
}

function VoiceRowLight({ run }: { run: boolean }) {
  return (
    <div className="flex items-center gap-2 text-text">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
        <Play aria-hidden className="size-4" />
      </span>
      <span aria-hidden className="flex h-7 items-center gap-[2px]">
        {WAVE.slice(0, 16).map((h, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-text-muted/60"
            style={{ height: `${h}%` }}
            animate={run ? { scaleY: [1, 0.6, 1] } : { scaleY: 1 }}
            transition={{ duration: 1 + (i % 3) * 0.2, repeat: Infinity, delay: i * 0.04 }}
          />
        ))}
      </span>
      <span className="tabular text-[0.6875rem]">0:09</span>
    </div>
  );
}

// ---------- Calls ----------

function NetworkBars({ level = 4 }: { level?: number }) {
  return (
    <span aria-hidden className="flex items-end gap-[2px]">
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={cn("w-[3px] rounded-[1px]", b <= level ? "bg-green-100" : "bg-white/30")}
          style={{ height: `${b * 3 + 2}px` }}
        />
      ))}
    </span>
  );
}

function Control({ children, tone }: { children: ReactNode; tone?: "danger" | "active" }) {
  return (
    <span
      className={cn(
        "flex size-11 items-center justify-center rounded-full",
        tone === "danger"
          ? "bg-danger-600 text-white"
          : tone === "active"
            ? "bg-yellow-400 text-ink-950"
            : "bg-white/20 text-white",
      )}
    >
      {children}
    </span>
  );
}

/** A video call: a lit room, an illustrated person who sways a little, a self view and live looking controls. */
export function VideoCallScreen({ person = "Tunde" }: { person?: DemoPerson }) {
  const { ref, run, reduced } = useRunning();
  const timer = useTimer(134, run);
  const index = DEMO_PEOPLE.indexOf(person) + 1;
  return (
    <div
      ref={ref}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-ink-950 text-white"
    >
      <motion.div
        className="absolute inset-0"
        animate={run ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <LitRoom className="absolute inset-0 size-full" />
      </motion.div>
      <motion.div
        className="absolute inset-x-[8%] bottom-0 top-[22%]"
        animate={run ? { y: [0, -5, 0], rotate: [0, 0.8, 0, -0.8, 0] } : { y: 0 }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src={`/images/people/person-${String(index).padStart(2, "0")}.png`}
          alt=""
          fill
          sizes="240px"
          className="object-contain object-bottom"
        />
      </motion.div>

      <div
        aria-hidden
        className="absolute inset-x-0 top-0 z-0 h-24 bg-gradient-to-b from-ink-950/80 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-0 h-24 bg-gradient-to-t from-ink-950/80 to-transparent"
      />

      <div className="relative z-10 flex items-center justify-between px-3 pt-2">
        <div>
          <p className="text-sm font-semibold">{person}</p>
          <p className="tabular flex items-center gap-1.5 text-xs text-white/85">
            <motion.span
              aria-hidden
              className="size-2 rounded-full bg-green-100"
              animate={run ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            {timer}
          </p>
        </div>
        <NetworkBars />
      </div>

      <div className="relative z-10 ml-auto mr-2.5 mt-3 h-24 w-[4.5rem] overflow-hidden rounded-xl border-2 border-white/80 bg-green-700">
        <Image
          src="/images/people/person-01.png"
          alt=""
          fill
          sizes="72px"
          className="object-cover object-top"
        />
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-center gap-2.5 px-2 pb-3">
        <Control>
          <MicOff aria-hidden className="size-5" />
        </Control>
        <Control tone="active">
          <Video aria-hidden className="size-5" />
        </Control>
        <Control>
          <RefreshCcw aria-hidden className="size-5" />
        </Control>
        <Control tone="danger">
          <PhoneOff aria-hidden className="size-5" />
        </Control>
      </div>
      {reduced ? null : null}
    </div>
  );
}

/** An audio call: a large illustrated avatar with speaking rings and a moving waveform. */
export function AudioCallScreen({ person = "Tunde" }: { person?: DemoPerson }) {
  const { ref, run } = useRunning();
  const timer = useTimer(61, run);
  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-1 flex-col items-center justify-between bg-ink-950 px-3 py-5 text-white"
    >
      <p className="flex items-center gap-2 text-xs text-white/80">
        <NetworkBars />
        {L.audio}
      </p>
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex size-28 items-center justify-center">
          {run ? (
            [0, 1].map((i) => (
              <motion.span
                key={i}
                aria-hidden
                className="absolute inset-0 rounded-full border-4 border-yellow-400"
                animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.9, ease: "easeOut" }}
              />
            ))
          ) : (
            <span
              aria-hidden
              className="absolute -inset-1 rounded-full border-4 border-yellow-400"
            />
          )}
          <PersonAvatar name={person} size={112} />
        </span>
        <p className="text-lg font-bold">{person}</p>
        <p className="tabular text-sm text-white/80">{timer}</p>
        <span aria-hidden className="flex h-8 items-center gap-[3px]">
          {WAVE.slice(0, 14).map((h, i) => (
            <motion.span
              key={i}
              className="w-[3px] origin-center rounded-full bg-yellow-400"
              style={{ height: `${h}%` }}
              animate={run ? { scaleY: [0.4, 1, 0.5] } : { scaleY: 0.7 }}
              transition={{ duration: 0.8 + (i % 4) * 0.15, repeat: Infinity, delay: i * 0.06 }}
            />
          ))}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Control>
          <MicOff aria-hidden className="size-5" />
        </Control>
        <Control>
          <VideoOff aria-hidden className="size-5" />
        </Control>
        <Control tone="danger">
          <PhoneOff aria-hidden className="size-5" />
        </Control>
      </div>
    </div>
  );
}

// ---------- Room ----------

export function RoomScreen() {
  const { ref, run } = useRunning();
  const [speaker, setSpeaker] = useState(0);
  const [video, setVideo] = useState(false);
  const [noting, setNoting] = useState(false);
  const [hand, setHand] = useState(false);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => setSpeaker((s) => (s + 1) % 4), 2200);
    const vid = window.setInterval(() => setVideo((v) => !v), 5200);
    const note = window.setInterval(() => setNoting((v) => !v), 8400);
    return () => {
      window.clearInterval(id);
      window.clearInterval(vid);
      window.clearInterval(note);
    };
  }, [run]);
  const people: { name: DemoPerson; badge?: string; muted?: boolean; hand?: boolean }[] = [
    { name: "Chidi", badge: L.host },
    { name: "Ngozi", badge: L.mod },
    { name: "Bayo" },
    { name: "Kemi", hand: true },
    { name: "Musa", muted: true },
    { name: "Funke" },
  ];
  return (
    <div ref={ref} className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Jollof or no jollof</p>
          <p className="text-[0.6875rem] text-text-muted">Food and chop, English</p>
        </div>
        <div
          role="group"
          aria-label={L.view}
          className="flex shrink-0 gap-0.5 rounded-full bg-surface-2 p-0.5"
        >
          {[L.audio, L.video].map((label, i) => {
            const on = video === (i === 1);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => setVideo(i === 1)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.625rem] font-semibold transition-colors",
                  on ? "bg-surface text-green-700 shadow-soft" : "text-text-muted",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <ul
        className={cn(
          "grid flex-1 content-center gap-x-1.5 gap-y-3 px-3 py-3",
          video ? "grid-cols-2 gap-2" : "grid-cols-3",
        )}
      >
        {people.map((p, i) =>
          video ? (
            <li key={p.name} className="relative aspect-[4/3] overflow-hidden rounded-lg">
              <LitRoom className="absolute inset-0 size-full" />
              <Image
                src={demoAvatarSrc(p.name)}
                alt=""
                fill
                sizes="130px"
                className="object-contain object-bottom p-1"
              />
              <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-ink-950/70 px-1.5 py-0.5 text-[0.5625rem] font-medium text-white">
                {p.muted ? (
                  <MicOff aria-hidden className="size-2.5" />
                ) : (
                  <Mic aria-hidden className="size-2.5" />
                )}
                {p.name}
              </span>
              {i === speaker ? (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-lg border-2 border-green-500"
                />
              ) : null}
              {p.hand || (hand && i === people.length - 1) ? (
                <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-yellow-400 text-ink-950">
                  <Hand aria-hidden className="size-2.5" />
                </span>
              ) : null}
            </li>
          ) : (
            <li key={p.name} className="flex flex-col items-center gap-1">
              <span className="relative">
                <PersonAvatar name={p.name} size={50} ring={i === speaker} />
                {p.hand || (hand && i === people.length - 1) ? (
                  <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-yellow-400 text-ink-950">
                    <Hand aria-hidden className="size-3.5" />
                  </span>
                ) : null}
                {i === speaker ? (
                  <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-green-600 text-white">
                    <Mic aria-hidden className="size-3" />
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-1 text-[0.6875rem] font-medium">
                {p.muted ? <MicOff aria-hidden className="size-3 text-text-muted" /> : null}
                {p.name}
              </span>
              {p.badge ? (
                <span className="rounded-full bg-yellow-400 px-1.5 text-[0.5625rem] font-bold text-ink-950">
                  {p.badge}
                </span>
              ) : null}
            </li>
          ),
        )}
      </ul>
      <AnimatePresence>
        {noting ? (
          <motion.aside
            key="room-notes"
            aria-label={L.notes}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={run ? { duration: 0.25 } : { duration: 0 }}
            className="absolute inset-y-0 right-0 z-10 flex w-[64%] flex-col border-l border-border bg-surface-2"
          >
            <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1.5">
              <p className="min-w-0 truncate text-[0.6875rem] font-bold">{L.notes}</p>
              <button
                type="button"
                aria-label={L.close}
                onClick={() => setNoting(false)}
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface"
              >
                <X aria-hidden className="size-3" />
              </button>
            </div>
            <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
              <li className="rounded-lg bg-yellow-400 p-2 text-[0.625rem] leading-snug text-ink-950">
                Balogun market on Saturday, who dey go?
                <span className="tabular mt-1 block text-[0.5625rem] text-ink-700">
                  {L.you} · 9:41
                </span>
              </li>
              <li className="rounded-lg bg-yellow-400 p-2 text-[0.625rem] leading-snug text-ink-950">
                Peppered chicken wins, no debate.
                <span className="tabular mt-1 block text-[0.5625rem] text-ink-700">
                  {L.you} · 9:44
                </span>
              </li>
            </ul>
            <div className="border-t border-border p-1.5">
              <p className="rounded-full border border-border bg-surface px-2 py-1 text-[0.5625rem] text-text-muted">
                Write a note
              </p>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
      <div className="flex items-center justify-center gap-1.5 px-3 pb-1">
        <button
          type="button"
          aria-pressed={hand}
          aria-label={L.raiseHand}
          onClick={() => setHand((h) => !h)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-colors",
            hand ? "bg-yellow-400 text-ink-950" : "bg-surface-2 text-text",
          )}
        >
          <Hand aria-hidden className="size-3.5" />
        </button>
        <button
          type="button"
          aria-pressed={noting}
          aria-label={L.notes}
          onClick={() => setNoting((v) => !v)}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-colors",
            noting ? "bg-yellow-400 text-ink-950" : "bg-surface-2 text-text",
          )}
        >
          <NotebookPen aria-hidden className="size-3.5" />
        </button>
      </div>
      <div className="px-2.5 pb-1">
        <p className="inline-block rounded-bubble bg-surface-2 px-2.5 py-1 text-[0.6875rem]">
          Ngozi: jollof party is the answer {CLAP}
        </p>
      </div>
      <ComposerDemo />
    </div>
  );
}

// ---------- Alerts ----------

export function AlertsScreen() {
  const { ref, run } = useRunning();
  const items = [
    {
      icon: <Video aria-hidden className="size-5" />,
      avatar: "Tunde" as DemoPerson,
      title: "Tunde is calling",
      body: "Video call",
      tint: "bg-green-600 text-white",
    },
    {
      icon: <BellRing aria-hidden className="size-5" />,
      avatar: "Ada" as DemoPerson,
      title: "Ada",
      body: "Send the highlights abeg",
      tint: "bg-yellow-400 text-ink-950",
    },
    {
      icon: <UserPlus aria-hidden className="size-5" />,
      avatar: "Ifeanyi" as DemoPerson,
      title: "New friend request",
      body: "Ifeanyi wants to be your friend",
      tint: "bg-ink-700 text-white",
    },
  ];
  return (
    <div
      ref={ref}
      className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 bg-ink-950 px-3 py-4 text-ink-950"
    >
      <p className="text-center text-xs text-white/70">{L.tabClosed}</p>
      {items.map((it, i) => (
        <motion.div
          key={it.title}
          initial={false}
          animate={run ? { y: [14, 0, 0, 0], opacity: [0, 1, 1, 1] } : { y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: i * 0.7, repeat: Infinity, repeatDelay: 4 }}
          className="flex items-center gap-2.5 rounded-2xl bg-white/95 p-2.5 shadow-soft"
        >
          <PersonAvatar name={it.avatar} size={38} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-semibold">{it.title}</span>
            <span className="block truncate text-[0.6875rem] text-ink-700">{it.body}</span>
          </span>
          <span
            className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", it.tint)}
          >
            {it.icon}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// ---------- Data saver ----------

export function DataScreen({ level: fixed }: { level?: number } = {}) {
  const { ref, run } = useRunning();
  const [auto, setLevel] = useState(4);
  const level = fixed ?? auto;
  useEffect(() => {
    if (!run || fixed !== undefined) return;
    const id = window.setInterval(() => setLevel((l) => (l <= 1 ? 4 : l - 1)), 1800);
    return () => window.clearInterval(id);
  }, [run, fixed]);
  const audioOnly = level <= 2;
  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col items-center justify-between px-3 py-5">
      <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-ink-950">
        <Wifi aria-hidden className="size-3.5" />
        {L.dataSaver}
      </span>
      <div className="flex flex-col items-center gap-3">
        {audioOnly ? (
          <PersonAvatar name="Zainab" size={96} ring />
        ) : (
          <div className="relative h-36 w-48 overflow-hidden rounded-card">
            <PitchPhoto className="absolute inset-0 size-full" />
          </div>
        )}
        <p className="text-base font-bold">{audioOnly ? L.audioOnly : L.video}</p>
      </div>
      <span aria-hidden className="flex items-end gap-1.5">
        {[1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className={cn("w-3 rounded-sm", b <= level ? "bg-green-600" : "bg-border")}
            style={{ height: `${b * 0.6 + 0.5}rem` }}
          />
        ))}
      </span>
    </div>
  );
}

// ---------- Wrapped phones ----------

export function ChatMock() {
  return (
    <PhoneFrame>
      <ChatScreen />
    </PhoneFrame>
  );
}
export function CallMock() {
  return (
    <PhoneFrame tone="light">
      <VideoCallScreen />
    </PhoneFrame>
  );
}
export function AudioCallMock() {
  return (
    <PhoneFrame tone="light">
      <AudioCallScreen />
    </PhoneFrame>
  );
}
export function RoomMock() {
  return (
    <PhoneFrame>
      <RoomScreen />
    </PhoneFrame>
  );
}
export function AlertsMock() {
  return (
    <PhoneFrame>
      <AlertsScreen />
    </PhoneFrame>
  );
}
export function DataMock() {
  return (
    <PhoneFrame>
      <DataScreen />
    </PhoneFrame>
  );
}
