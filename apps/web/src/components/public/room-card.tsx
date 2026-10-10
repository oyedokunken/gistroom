import Link from "next/link";
import { CalendarClock, Mic } from "lucide-react";
import { LANGUAGE_LABELS, type PublicRoomCard } from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { roomsPage } from "@/content/pages";

const when = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function RoomCard({ room }: { room: PublicRoomCard }) {
  const live = room.status === "LIVE";
  return (
    <li>
      <Link
        href={`/rooms/${room.slug}`}
        className="flex h-full flex-col gap-3 rounded-card border border-border bg-surface p-5 transition-shadow hover:shadow-lift"
      >
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <Badge tone="yellow">
              <Mic aria-hidden className="mr-1 size-3" />
              Live
            </Badge>
          ) : (
            <Badge tone="neutral">
              <CalendarClock aria-hidden className="mr-1 size-3" />
              {room.scheduledFor
                ? roomsPage.scheduled(when.format(new Date(room.scheduledFor)))
                : "Scheduled"}
            </Badge>
          )}
          {room.topicName ? <Badge tone="green">{room.topicName}</Badge> : null}
          <Badge tone="neutral">{LANGUAGE_LABELS[room.language]}</Badge>
        </div>
        <h3 className="text-xl font-bold leading-tight text-text">{room.title}</h3>
        {room.description ? (
          <p className="line-clamp-2 text-text-muted">{room.description}</p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 pt-1 text-sm text-text-muted">
          <Avatar name={room.host.name} src={room.host.avatarUrl} size={28} />
          <span className="truncate">{room.host.name}</span>
          {live ? <span className="tabular ml-auto">{room.listeners} in the room</span> : null}
        </div>
      </Link>
    </li>
  );
}
