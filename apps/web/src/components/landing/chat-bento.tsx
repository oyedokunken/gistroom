"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  AudioLines,
  Clock,
  Images,
  Mic,
  Paperclip,
  Pause,
  Play,
  SendHorizontal,
  Smile,
  SmilePlus,
  Square,
  Star,
  Check,
} from "lucide-react";
import { type ReactionDto } from "@gistroom/shared";
import { ReactionChips } from "@/components/chat/reaction-chips";
import { PitchPhoto, StreetPhoto } from "@/components/mock/scenes";
import { chat } from "@/content/chat";
import { homeCopy as copy } from "@/content/home";
import { useCalm } from "@/lib/calm";
import { cn } from "@/lib/cn";

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
