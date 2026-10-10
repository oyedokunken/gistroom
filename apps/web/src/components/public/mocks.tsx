"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import {
  BellRing,
  Check,
  CheckCheck,
  Flag,
  Laptop,
  Mic,
  MicOff,
  MonitorSmartphone,
  PhoneOff,
  Plus,
  Share,
  ShieldCheck,
  Smartphone,
  UserPlus,
  UserX,
  Video,
  Wifi,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { mockLabels as L } from "@/content/marketing";
import { cn } from "@/lib/cn";

const tones = [
  "bg-yellow-400 text-ink-950",
  "bg-green-600 text-white",
  "bg-ink-950 text-white",
  "bg-green-100 text-ink-950",
  "bg-yellow-100 text-ink-950",
] as const;

export function MockAvatar({
  name,
  tone = 0,
  size = 44,
  ring,
}: {
  name: string;
  tone?: number;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        tones[tone % tones.length],
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1)}
      {ring ? (
        <span className="absolute -inset-1 rounded-full border-4 border-green-600 motion-safe:animate-pulse" />
      ) : null}
    </span>
  );
}

/** A phone outline. Everything inside is a labeled sample, never real data. */
export function PhoneFrame({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <figure className={cn("w-full max-w-[19rem]", className)}>
      <div className="rounded-[2.5rem] border-[10px] border-ink-950 bg-surface p-0 shadow-lift">
        <div className="relative flex min-h-[27rem] flex-col overflow-hidden rounded-[1.75rem] bg-surface text-text">
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-border" />
          {children}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm opacity-70">{label}</figcaption>
    </figure>
  );
}

function Bubble({
  mine,
  children,
  meta,
}: {
  mine?: boolean;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-bubble px-3 py-2 text-sm leading-snug",
          mine
            ? "rounded-br-[4px] bg-green-600 text-white"
            : "rounded-bl-[4px] bg-surface-2 text-text",
        )}
      >
        {children}
        {meta ? (
          <span className="mt-1 flex items-center justify-end gap-1 text-[0.6875rem] opacity-80">
            {meta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ChatMock() {
  return (
    <PhoneFrame label={L.sample}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <MockAvatar name="Ada" tone={1} size={36} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Ada</p>
          <p className="text-xs font-medium text-green-700">{L.typing}...</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 px-3 py-4">
        <Bubble>Did you watch the match last night?</Bubble>
        <Bubble
          mine
          meta={
            <>
              <span>{L.edited}</span>
              <span className="tabular">9:41</span>
              <CheckCheck aria-hidden className="size-3" />
            </>
          }
        >
          Ah, I screamed. We move!
        </Bubble>
        <div className="-mt-1 flex justify-end">
          <span className="tabular rounded-full border border-border bg-surface px-2 py-0.5 text-xs">
            2 reactions
          </span>
        </div>
        <Bubble>
          <span className="mb-1 block rounded-lg border-l-4 border-green-600 bg-surface px-2 py-1 text-xs text-text-muted">
            {L.replyTo}
          </span>
          Send the highlights abeg
        </Bubble>
        <div className="flex items-center gap-1.5 self-start rounded-bubble rounded-bl-[4px] bg-surface-2 px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className="size-2 rounded-full bg-text-muted motion-safe:animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function CallMock() {
  const reduced = useReducedMotion();
  const [video, setVideo] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setVideo((v) => !v), 2800);
    return () => window.clearInterval(id);
  }, [reduced]);
  return (
    <PhoneFrame label={L.sample}>
      <div className="flex flex-1 flex-col items-center justify-between bg-ink-950 px-4 py-8 text-white">
        <p className="text-sm text-white/80">{video ? L.video : L.audio}</p>
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center overflow-hidden transition-all duration-500",
              video
                ? "h-44 w-full rounded-card bg-green-700"
                : "size-28 rounded-full bg-yellow-400",
            )}
          >
            <span
              className={cn("font-black", video ? "text-6xl text-white" : "text-5xl text-ink-950")}
            >
              T
            </span>
          </div>
          <p className="text-xl font-bold">Tunde</p>
          <p className="tabular text-white/80">02:14</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/15">
            <MicOff aria-hidden className="size-5" />
          </span>
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-full",
              video ? "bg-yellow-400 text-ink-950" : "bg-white/15",
            )}
          >
            <Video aria-hidden className="size-5" />
          </span>
          <span className="flex size-12 items-center justify-center rounded-full bg-danger-600">
            <PhoneOff aria-hidden className="size-5" />
          </span>
        </div>
      </div>
    </PhoneFrame>
  );
}

export function RoomMock() {
  const people = [
    { n: "Chidi", speaking: true, host: true },
    { n: "Bola", speaking: false },
    { n: "Ife", speaking: true },
    { n: "Musa", speaking: false, muted: true },
    { n: "Ngozi", speaking: false },
    { n: "Kemi", speaking: false },
  ];
  return (
    <PhoneFrame label={L.sampleRoom}>
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Jollof or no jollof</p>
        <p className="text-xs text-text-muted">Food and chop, English</p>
      </div>
      <ul className="grid flex-1 grid-cols-3 content-center gap-x-2 gap-y-5 px-4 py-6">
        {people.map((p, i) => (
          <li key={p.n} className="flex flex-col items-center gap-2">
            <MockAvatar name={p.n} tone={i} size={52} ring={p.speaking} />
            <span className="flex items-center gap-1 text-xs font-medium">
              {p.muted ? <MicOff aria-hidden className="size-3 text-text-muted" /> : null}
              {p.n}
            </span>
            {p.host ? (
              <span className="rounded-full bg-yellow-400 px-2 text-[0.625rem] font-bold text-ink-950">
                {L.host}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-center gap-3 border-t border-border py-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2">
          <Mic aria-hidden className="size-5" />
        </span>
        <span className="flex size-11 items-center justify-center rounded-full bg-danger-600 text-white">
          <PhoneOff aria-hidden className="size-5" />
        </span>
      </div>
    </PhoneFrame>
  );
}

export function AlertsMock() {
  const items = [
    { icon: Video, title: "Tunde is calling", body: "Video call", tone: "bg-green-600 text-white" },
    {
      icon: BellRing,
      title: "Ada",
      body: "Send the highlights abeg",
      tone: "bg-yellow-400 text-ink-950",
    },
    {
      icon: UserPlus,
      title: "Friend request",
      body: "Ife wants to be your friend",
      tone: "bg-ink-950 text-white",
    },
  ];
  return (
    <PhoneFrame label={L.sampleAlerts}>
      <div className="flex flex-1 flex-col justify-center gap-3 bg-ink-950 px-4 py-8">
        <p className="text-center text-sm text-white/70">Tab closed</p>
        {items.map((it, i) => (
          <div
            key={it.title}
            className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-ink-950 shadow-soft motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 400}ms`, animationDuration: "3s" }}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                it.tone,
              )}
            >
              <it.icon aria-hidden className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{it.title}</span>
              <span className="block truncate text-xs text-ink-700">{it.body}</span>
            </span>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

export function DataMock() {
  const reduced = useReducedMotion();
  const [level, setLevel] = useState(3);
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setLevel((l) => (l <= 1 ? 4 : l - 1)), 1800);
    return () => window.clearInterval(id);
  }, [reduced]);
  const audioOnly = level <= 2;
  return (
    <PhoneFrame label={L.sample}>
      <div className="flex flex-1 flex-col items-center justify-between px-4 py-8">
        <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-ink-950">
          <Wifi aria-hidden className="size-3.5" />
          {L.dataSaver}
        </div>
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "flex items-center justify-center bg-green-600 text-white transition-all duration-500",
              audioOnly ? "size-24 rounded-full" : "h-36 w-52 rounded-card",
            )}
          >
            {audioOnly ? (
              <Mic aria-hidden className="size-9" />
            ) : (
              <Video aria-hidden className="size-9" />
            )}
          </div>
          <p className="text-lg font-bold">{audioOnly ? L.audioOnly : L.video}</p>
        </div>
        <div aria-hidden className="flex items-end gap-1.5">
          {[1, 2, 3, 4].map((b) => (
            <span
              key={b}
              className={cn("w-3 rounded-sm", b <= level ? "bg-green-600" : "bg-border")}
              style={{ height: `${b * 0.6 + 0.5}rem` }}
            />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

export function DevicesMock() {
  const rows = [
    { icon: Laptop, name: "Chrome on Windows", note: L.thisDevice },
    { icon: Smartphone, name: "Safari on iPhone", note: "Yesterday" },
    { icon: MonitorSmartphone, name: "Edge on Windows", note: "Last week" },
  ];
  return (
    <PhoneFrame label={L.sampleDevices}>
      <div className="flex flex-1 flex-col gap-3 px-4 py-6">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck aria-hidden className="size-4 text-green-600" />
          Signed in devices
        </p>
        {rows.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <r.icon aria-hidden className="size-6 shrink-0 text-green-600" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.name}</span>
              <span className="block text-xs text-text-muted">{r.note}</span>
            </span>
            {i > 0 ? (
              <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold">
                {L.signOut}
              </span>
            ) : (
              <Check aria-hidden className="size-4 text-green-600" />
            )}
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

export function SafetyMock() {
  return (
    <PhoneFrame label={L.sample}>
      <div className="flex flex-1 flex-col justify-center gap-3 px-4 py-8">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <MockAvatar name="Kunle" tone={2} size={40} />
          <div>
            <p className="text-sm font-semibold">Kunle</p>
            <p className="text-xs text-text-muted">Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm font-semibold">
          <UserX aria-hidden className="size-5 text-danger-600" />
          {L.block}
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border p-3 text-sm font-semibold">
          <Flag aria-hidden className="size-5 text-danger-600" />
          {L.report}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-yellow-400 p-3 text-sm font-semibold text-ink-950">
          <ShieldCheck aria-hidden className="size-5" />
          {L.mod}: mute, remove, ban
        </div>
      </div>
    </PhoneFrame>
  );
}

export function InstallMock() {
  return (
    <PhoneFrame label={L.sample}>
      <div className="flex flex-1 flex-col justify-between bg-green-100 px-5 py-8 text-ink-950">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} aria-hidden className="aspect-square rounded-2xl bg-white/70" />
          ))}
          <span className="flex aspect-square items-center justify-center rounded-2xl bg-green-600 text-white shadow-soft">
            <LogoMark size={32} bubble="currentColor" className="text-white" />
          </span>
        </div>
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-3 text-sm font-semibold">
          <Share aria-hidden className="size-5 text-green-600" />
          <Plus aria-hidden className="size-4" />
          Add to Home Screen
        </div>
      </div>
    </PhoneFrame>
  );
}
