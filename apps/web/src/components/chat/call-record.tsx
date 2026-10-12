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
    <div className="my-3 flex justify-center">
      <div
        role="note"
        className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-2.5 text-center"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            outcome === "ANSWERED"
              ? "bg-green-100 text-green-700"
              : "bg-danger-600/10 text-danger-600",
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        <span className="flex flex-col items-start text-left">
          <span className="text-sm font-semibold text-text">{label}</span>
          <span className="tabular text-sm text-text">{detail}</span>
          <time
            dateTime={started.toISOString()}
            title={formatFull(started)}
            className="text-xs text-text-muted"
          >
            {chat.callRecord.at(formatDayLabel(started), formatClock(started))}
          </time>
        </span>
      </div>
    </div>
  );
}
