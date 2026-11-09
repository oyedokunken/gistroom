"use client";

import Link from "next/link";
import { CalendarClock, Mic, Users } from "lucide-react";
import { LANGUAGE_LABELS, roomCountLabel, type PublicRoomCard } from "@gistroom/shared";
import { RoomAction } from "@/components/rooms/room-action";
import { useRoomSelection } from "@/components/rooms/room-selection";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { roomCards } from "@/content/room-cards";
import { roomsPage } from "@/content/pages";
import { cn } from "@/lib/cn";

const when = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * A room on the public list. Live rooms and upcoming rooms use the same card, labelled Live or Upcoming, with the count
 * that fits (in room, or attending) and one honest action. Choosing the card opens its details panel when there is one.
 */
export function RoomCard({
  room,
  hrefBase = "/rooms",
}: {
  room: PublicRoomCard;
  /** Where the card opens when there is no details panel. Signed in screens use /app/rooms. */
  hrefBase?: string;
}) {
  const selection = useRoomSelection();
  const live = room.status === "LIVE";
  const on = selection?.selected === room.slug;
  const overlay =
    "absolute inset-0 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600";
  return (
    <li className="relative">
      <div
        className={cn(
          "flex h-full flex-col gap-3 rounded-card border bg-surface p-5 transition-shadow hover:shadow-lift",
          on ? "border-green-600 shadow-lift" : "border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <Badge tone="yellow">
              <Mic aria-hidden className="mr-1 size-3" />
              {roomCards.status.live}
            </Badge>
          ) : (
            <Badge tone="neutral">
              <CalendarClock aria-hidden className="mr-1 size-3" />
              {room.scheduledFor
                ? roomsPage.scheduled(when.format(new Date(room.scheduledFor)))
                : roomCards.status.upcoming}
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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <span className="tabular flex items-center gap-2 text-sm font-semibold text-text">
            <Users aria-hidden className="size-4 text-text-muted" />
            {roomCountLabel(room)}
          </span>
          <span className="relative z-10">
            <RoomAction room={room} />
          </span>
        </div>
      </div>
      {selection ? (
        <button
          type="button"
          aria-pressed={on}
          aria-label={`${roomCards.action.details}: ${room.title}`}
          onClick={() => selection.select(on ? null : room.slug)}
          className={overlay}
        />
      ) : (
        <Link
          href={`${hrefBase}/${room.slug}`}
          aria-label={`${roomCards.action.details}: ${room.title}`}
          className={overlay}
        />
      )}
    </li>
  );
}
