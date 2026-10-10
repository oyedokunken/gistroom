"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Pause,
  Play,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { fileFamily, formatBytes, type AttachmentDto, type MessageDto } from "@gistroom/shared";
import { Modal } from "@/components/ui/modal";
import { chat } from "@/content/chat";
import { formatDuration } from "@/lib/chat/voice";
import { cn } from "@/lib/cn";

const mediaUrl = (a: AttachmentDto, thumb = false) =>
  `/api/media/${a.id}${thumb ? "?thumb=1" : ""}`;

function ImageView({ a, caption }: { a: AttachmentDto; caption: string }) {
  const [open, setOpen] = useState(false);
  const ratio = a.width && a.height ? a.width / a.height : 4 / 3;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={chat.media.openImage}
        className="relative block w-[min(18rem,70vw)] overflow-hidden rounded-xl bg-surface-2"
        style={{ aspectRatio: String(Math.min(2, Math.max(0.5, ratio))) }}
      >
        <Image
          src={mediaUrl(a, a.hasThumb)}
          alt={caption || chat.media.imageAlt}
          fill
          unoptimized
          sizes="288px"
          className="object-cover"
        />
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={caption || chat.media.imageAlt}
        className="w-[min(96vw,64rem)]"
      >
        <div className="relative max-h-[75dvh] min-h-[40dvh] w-full">
          {/* The full file is loaded only when the viewer opens. */}
          <img
            src={mediaUrl(a)}
            alt={caption || chat.media.imageAlt}
            className="mx-auto max-h-[75dvh] w-auto max-w-full rounded-xl object-contain"
          />
        </div>
      </Modal>
    </>
  );
}

function VideoView({ a }: { a: AttachmentDto }) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- chat media from people has no caption track
    <video
      controls
      playsInline
      preload="metadata"
      poster={a.hasThumb ? mediaUrl(a, true) : undefined}
      src={mediaUrl(a)}
      aria-label={chat.media.video}
      className="max-h-80 w-[min(20rem,72vw)] rounded-xl bg-ink-950"
    />
  );
}

const SPEEDS = [1, 1.5, 2] as const;

export function VoiceView({ a, mine }: { a: AttachmentDto; mine: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const bars = a.waveform.length > 0 ? a.waveform : Array.from({ length: 40 }, () => 30);
  const total = a.durationMs ?? 0;

  useEffect(() => {
    const el = audio.current;
    if (el) el.playbackRate = speed;
  }, [speed]);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function cycleSpeed() {
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length] ?? 1);
  }

  const current = Math.min(bars.length - 1, Math.floor(progress * bars.length));
  return (
    <div className="flex w-[min(17rem,66vw)] items-center gap-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- voice notes have no caption track */}
      <audio
        ref={audio}
        src={mediaUrl(a)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget;
          const d = t.duration && Number.isFinite(t.duration) ? t.duration : total / 1000;
          setProgress(d ? t.currentTime / d : 0);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? chat.media.pause : chat.media.play}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          mine ? "bg-white text-green-700" : "bg-green-600 text-white",
        )}
      >
        {playing ? (
          <Pause aria-hidden className="size-5" />
        ) : (
          <Play aria-hidden className="size-5" />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div aria-hidden className="flex h-8 items-center gap-[2px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-[3px] shrink-0 rounded-full",
                i <= current && progress > 0
                  ? mine
                    ? "bg-yellow-400"
                    : "bg-green-600"
                  : mine
                    ? "bg-white/55"
                    : "bg-text-muted/50",
              )}
              style={{ height: `${Math.max(12, h)}%` }}
            />
          ))}
        </div>
        <span className="tabular text-xs opacity-80">{formatDuration(total)}</span>
      </div>
      <button
        type="button"
        onClick={cycleSpeed}
        aria-label={chat.media.speed(speed)}
        className={cn(
          "tabular min-h-11 min-w-11 rounded-full text-xs font-bold",
          mine ? "bg-white/20" : "bg-surface",
        )}
      >
        {speed}x
      </button>
    </div>
  );
}

const icons: Record<ReturnType<typeof fileFamily>, LucideIcon> = {
  pdf: FileText,
  word: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  text: FileText,
  other: FileIcon,
};

const badge: Record<ReturnType<typeof fileFamily>, string> = {
  pdf: "bg-danger-600 text-white",
  word: "bg-green-600 text-white",
  sheet: "bg-green-700 text-white",
  slides: "bg-yellow-400 text-ink-950",
  text: "bg-ink-700 text-white",
  other: "bg-ink-700 text-white",
};

function FileView({ a, name, mine }: { a: AttachmentDto; name: string; mine: boolean }) {
  const family = fileFamily(a.mime);
  const Icon = icons[family];
  return (
    <div
      className={cn(
        "flex w-[min(19rem,72vw)] items-center gap-3 rounded-xl p-2",
        mine ? "bg-white/15" : "bg-surface",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          badge[family],
        )}
      >
        <Icon aria-hidden className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        <span className="tabular block text-xs opacity-80">
          {chat.media.family[family]} · {formatBytes(a.sizeBytes)}
        </span>
      </span>
      <a
        href={mediaUrl(a)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${chat.media.open}: ${name}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
      >
        {family === "pdf" || family === "text" ? (
          <ExternalLink aria-hidden className="size-5" />
        ) : (
          <Download aria-hidden className="size-5" />
        )}
      </a>
    </div>
  );
}

/** Draws whatever a message carries: a photo, a video, a voice note or a file card. */
export function AttachmentView({ message, mine }: { message: MessageDto; mine: boolean }) {
  const a = message.attachments[0];
  if (!a) return null;
  const meta = message.meta as { fileName?: string } | null;
  const name = meta?.fileName ?? chat.media.fileFallback;
  const caption = message.body ?? "";
  if (message.type === "IMAGE") return <ImageView a={a} caption={caption} />;
  if (message.type === "VIDEO") return <VideoView a={a} />;
  if (message.type === "VOICE") return <VoiceView a={a} mine={mine} />;
  return <FileView a={a} name={name} mine={mine} />;
}
