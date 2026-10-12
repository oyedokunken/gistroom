import Link from "next/link";
import { Lock, Video, Mic } from "lucide-react";
import type { MessageDto } from "@gistroom/shared";
import { buttonStyles } from "@/components/ui/button";
import { roomCopy } from "@/content/rooms";
import { cn } from "@/lib/cn";
import { formatFull } from "@/lib/time";

interface InviteMeta {
  roomSlug: string;
  title: string;
  visibility?: "PUBLIC" | "PRIVATE";
  topic?: string | null;
  host?: string | null;
  media?: "AUDIO" | "VIDEO";
  scheduledFor?: string | null;
}

function readMeta(message: MessageDto): InviteMeta | null {
  const m = message.meta as Partial<InviteMeta> | null;
  if (!m || typeof m.roomSlug !== "string" || typeof m.title !== "string") return null;
  return m as InviteMeta;
}

/** A room shared in a chat: title, topic, host, when, and one button to go in. */
export function RoomInviteCard({ message, mine }: { message: MessageDto; mine: boolean }) {
  const meta = readMeta(message);
  if (!meta) return <span>{message.body}</span>;
  const MediaIcon = meta.media === "VIDEO" ? Video : Mic;
  return (
    <span
      className={cn(
        "block w-64 max-w-full rounded-2xl p-3 text-left",
        mine ? "bg-white/15" : "bg-surface text-text",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
        <MediaIcon aria-hidden className="size-3.5" />
        {meta.media === "VIDEO" ? roomCopy.create.video : roomCopy.create.audio}
        {meta.visibility === "PRIVATE" ? (
          <>
            <Lock aria-hidden className="ml-1 size-3.5" />
            {roomCopy.create.private}
          </>
        ) : null}
      </span>
      <span className="mt-1 block text-base font-bold leading-snug">{meta.title}</span>
      {meta.topic ? <span className="block text-sm opacity-90">{meta.topic}</span> : null}
      {meta.host ? <span className="block text-sm opacity-90">{meta.host}</span> : null}
      {meta.scheduledFor ? (
        <span className="tabular block text-sm opacity-90">
          {roomCopy.stage.startingSoon(formatFull(new Date(meta.scheduledFor)))}
        </span>
      ) : null}
      <Link
        href={`/app/rooms/${meta.roomSlug}`}
        className={cn(buttonStyles(mine ? "accent" : "primary"), "mt-3 w-full justify-center")}
      >
        {roomCopy.stage.join}
      </Link>
    </span>
  );
}
