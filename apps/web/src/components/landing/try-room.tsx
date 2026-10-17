"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Hand, Mic, MicOff, NotebookPen, Settings, X } from "lucide-react";
import { DEMO_PEOPLE, type DemoPerson } from "@gistroom/shared";
import { PersonAvatar } from "@/components/mock/screens";
import { LitRoom } from "@/components/mock/scenes";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { homeCopy as copy } from "@/content/home";
import { mockLabels as L } from "@/content/marketing";
import { useCalm } from "@/lib/calm";
import { cn } from "@/lib/cn";

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
