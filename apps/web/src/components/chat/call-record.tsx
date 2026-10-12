import { Phone, PhoneMissed, Video, VideoOff } from "lucide-react";
import type { MessageDto } from "@gistroom/shared";
import { chat } from "@/content/chat";
import { cn } from "@/lib/cn";
import { formatClock, formatDayLabel, formatDuration, formatFull } from "@/lib/time";

interface CallMeta {
  media?: "AUDIO" | "VIDEO";
  outcome?: "ANSWERED" | "MISSED" | "DECLINED";
  durationSec?: number;
  startedAt?: string;
  callerId?: string;
}

/** A call, shown in the middle of the chat like a day separator: the icon, how it went, and when it started. */
export function CallRecord({
  message,
  meId,
  peerName,
}: {
  message: MessageDto;
  meId: string;
  peerName: string;
}) {
  const meta = (message.meta ?? {}) as CallMeta;
  const video = meta.media === "VIDEO";
  const outcome = meta.outcome ?? "ANSWERED";
  const started = new Date(meta.startedAt ?? message.createdAt);
  const iMadeIt = meta.callerId === meId;
  const label = video ? chat.callRecord.video : chat.callRecord.voice;
  const Icon = outcome === "ANSWERED" ? (video ? Video : Phone) : video ? VideoOff : PhoneMissed;
  const detail =
    outcome === "ANSWERED"
      ? formatDuration(meta.durationSec ?? 0)
      : outcome === "DECLINED"
        ? iMadeIt
          ? chat.callRecord.declinedByThem(peerName)
          : chat.callRecord.declinedByMe
        : iMadeIt
          ? chat.callRecord.noAnswer
          : chat.callRecord.missed;

  return (
    <div className="my-3 flex justify-center px-2">
      <div
        role="note"
        className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 sm:max-w-md sm:gap-4 sm:px-5 sm:py-4 lg:max-w-lg"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full sm:size-12",
            outcome === "ANSWERED"
              ? "bg-green-100 text-green-700"
              : "bg-danger-600/10 text-danger-600",
          )}
        >
          <Icon aria-hidden className="size-5 sm:size-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span className="text-sm font-semibold text-text sm:text-base">{label}</span>
          <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-text-muted">
            <span className="tabular font-semibold text-text">{detail}</span>
            <span aria-hidden>{"|"}</span>
            <time dateTime={started.toISOString()} title={formatFull(started)} className="tabular">
              {chat.callRecord.at(formatDayLabel(started), formatClock(started))}
            </time>
          </span>
        </span>
      </div>
    </div>
  );
}
