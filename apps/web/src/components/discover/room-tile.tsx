import Link from "next/link";
import { CalendarClock, Lock, Mic, Users, Video } from "lucide-react";
import { LANGUAGE_LABELS, type DiscoverRoom } from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { discover as copy } from "@/content/discover";
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
 * One room on Discover. The whole card is one link, so it works with a keyboard and a screen reader. It lifts a little
 * on hover, and shows who is inside, how many, what it is about and whether it is audio or video.
 */
export function RoomTile({ room }: { room: DiscoverRoom }) {
  const live = room.status === "LIVE";
  const MediaIcon = room.media === "VIDEO" ? Video : Mic;
  const count = room.listeners;
  return (
    <li className="h-full">
      <Link
        href={`/app/rooms/${room.slug}`}
        className={cn(
          "group flex h-full flex-col gap-3 rounded-card border bg-surface p-5 transition-all",
          "hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-y-0.5 focus-visible:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          room.invitedOnly ? "border-green-600" : "border-border",
        )}
      >
        <span className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-2.5 py-1 text-ink-950">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-ink-950 motion-safe:animate-pulse"
              />
              {copy.card.live}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-text">
              <CalendarClock aria-hidden className="size-3.5" />
              {room.scheduledFor
                ? copy.card.starts(when.format(new Date(room.scheduledFor)))
                : "Scheduled"}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-green-700">
            <MediaIcon aria-hidden className="size-3.5" />
            {room.media === "VIDEO" ? copy.card.video : copy.card.audio}
          </span>
          {room.invitedOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-text">
              <Lock aria-hidden className="size-3.5" />
              <span className="sr-only">{copy.card.invited}</span>
            </span>
          ) : null}
        </span>

        <span className="flex flex-col gap-1">
          <span className="line-clamp-2 text-lg font-bold leading-snug text-text">
            {room.title}
          </span>
          <span className="line-clamp-1 text-sm text-text-muted">
            {room.description ?? copy.card.noDescription}
          </span>
        </span>

        <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {room.topicName ? (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-text">
              {room.topicName}
            </span>
          ) : null}
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-text">
            {LANGUAGE_LABELS[room.language]}
          </span>
        </span>

        <span className="mt-auto flex items-center gap-3 pt-1">
          <Avatar name={room.host.name} src={room.host.avatarUrl} size={32} />
          <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
            {copy.card.hostedBy(room.host.name)}
          </span>
        </span>

        <span className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="flex items-center gap-2">
            {room.people.length > 0 ? (
              <span className="flex -space-x-2" aria-hidden>
                {room.people.map((p) => (
                  <span key={p.id} className="rounded-full ring-2 ring-surface">
                    <Avatar name={p.name} src={p.avatarUrl} size={28} />
                  </span>
                ))}
              </span>
            ) : (
              <Users aria-hidden className="size-4 text-text-muted" />
            )}
            <span className="tabular text-sm font-semibold text-text">
              {count > 0 ? copy.card.people(count) : copy.card.nobodyYet}
            </span>
          </span>
          <span className="inline-flex min-h-9 items-center rounded-full bg-green-600 px-4 text-sm font-semibold text-white group-hover:bg-green-700">
            {copy.card.join}
          </span>
        </span>
      </Link>
    </li>
  );
}
