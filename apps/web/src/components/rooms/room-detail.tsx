"use client";

import Link from "next/link";
import { CalendarClock, Lock, Mic, Users, Video } from "lucide-react";
import {
  LANGUAGE_LABELS,
  roomCountLabel,
  type DiscoverRoom,
  type PublicRoomCard,
} from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { roomCards as copy } from "@/content/room-cards";
import { selectSignedIn, useAuthState } from "@/lib/auth-state";
import { formatFull } from "@/lib/time";
import { CopyRoomLink } from "./copy-room-link";
import { RelatedRooms } from "./related-rooms";
import { RoomAction } from "./room-action";

export type DetailRoom = PublicRoomCard & Partial<Pick<DiscoverRoom, "invitedOnly">>;

/**
 * Everything about one room in one panel: what it is, who hosts it, who is in it, the one action, a link to copy, and
 * other rooms you might like. Only public card data is shown, so nothing about a private room reaches anyone it is not for.
 */
export function RoomDetail({ room, onNavigate }: { room: DetailRoom; onNavigate?: () => void }) {
  const signedIn = useAuthState(selectSignedIn);
  const live = room.status === "LIVE";
  const MediaIcon = room.media === "VIDEO" ? Video : Mic;
  const page = signedIn ? `/app/rooms/${room.slug}` : `/rooms/${room.slug}`;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          <Badge tone="yellow">{copy.status.live}</Badge>
        ) : (
          <Badge tone="neutral">
            <CalendarClock aria-hidden className="mr-1 size-3" />
            {copy.status.upcoming}
          </Badge>
        )}
        <Badge tone="green">
          <MediaIcon aria-hidden className="mr-1 size-3" />
          {room.media === "VIDEO" ? copy.detail.video : copy.detail.audio}
        </Badge>
        {room.topicName ? <Badge tone="neutral">{room.topicName}</Badge> : null}
        <Badge tone="neutral">{LANGUAGE_LABELS[room.language]}</Badge>
        {room.invitedOnly ? (
          <Badge tone="neutral">
            <Lock aria-hidden className="mr-1 size-3" />
            {copy.detail.private}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black leading-tight text-text">{room.title}</h2>
        {room.description ? <p className="text-text-muted">{room.description}</p> : null}
      </div>

      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Avatar name={room.host.name} src={room.host.avatarUrl} size={32} />
        <span className="min-w-0 truncate">{copy.detail.hostedBy(room.host.name)}</span>
      </p>

      {!live && room.scheduledFor ? (
        <p className="tabular flex items-center gap-2 font-semibold text-text">
          <CalendarClock aria-hidden className="size-4" />
          <time dateTime={room.scheduledFor}>
            {copy.detail.startsAt(formatFull(new Date(room.scheduledFor)))}
          </time>
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="tabular flex items-center gap-2 text-sm font-semibold text-text">
          <Users aria-hidden className="size-4" />
          {roomCountLabel(room)}
        </p>
        {live ? (
          room.people.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="flex -space-x-2" aria-hidden>
                {room.people.map((p) => (
                  <span key={p.id} className="rounded-full ring-2 ring-surface">
                    <Avatar name={p.name} src={p.avatarUrl} size={28} />
                  </span>
                ))}
              </span>
              <span className="sr-only">{copy.detail.inside}</span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{copy.detail.nobody}</p>
          )
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <RoomAction room={room} size="md" />
        <Link
          href={page}
          onClick={onNavigate}
          className="inline-flex min-h-11 items-center font-semibold text-green-700 underline-offset-4 hover:underline"
        >
          {copy.detail.openPage}
        </Link>
      </div>

      <CopyRoomLink slug={room.slug} visibility={room.invitedOnly ? "PRIVATE" : "PUBLIC"} />

      <RelatedRooms slug={room.slug} onNavigate={onNavigate} />
    </div>
  );
}
