"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Lock, Mic, Plus } from "lucide-react";
import { LANGUAGE_LABELS, type PublicRoomCard, type RoomDto } from "@gistroom/shared";
import { PageHeader } from "@/components/app/page-header";
import { CreateRoomModal } from "@/components/room/create-room-modal";
import { RoomsExplorer } from "@/components/public/rooms-explorer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { pages } from "@/content/app";
import { roomCopy as copy } from "@/content/rooms";
import { roomApi } from "@/lib/rooms/api";

function MyRoom({ room }: { room: RoomDto }) {
  const live = room.status === "LIVE";
  return (
    <li>
      <Link
        href={`/app/rooms/${room.slug}`}
        className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-4 hover:shadow-lift"
      >
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <Badge tone="yellow">
              <Mic aria-hidden className="mr-1 size-3" />
              Live
            </Badge>
          ) : (
            <Badge>Scheduled</Badge>
          )}
          {room.visibility === "PRIVATE" ? (
            <Badge>
              <Lock aria-hidden className="mr-1 size-3" />
              Private
            </Badge>
          ) : null}
          <span className="text-xs text-text-muted">{LANGUAGE_LABELS[room.language]}</span>
        </div>
        <p className="line-clamp-2 text-lg font-bold text-text">{room.title}</p>
        <p className="tabular text-sm text-text-muted">
          {room.myRole === "HOST" ? "You host this room. " : ""}
          {room.joined} in the room
        </p>
      </Link>
    </li>
  );
}

export function RoomsHome({
  initialRooms,
  initialFailed,
}: {
  initialRooms: PublicRoomCard[];
  initialFailed: boolean;
}) {
  const params = useSearchParams();
  const [creating, setCreating] = useState(false);
  const mine = useQuery({ queryKey: ["my-rooms"], queryFn: roomApi.mine });

  useEffect(() => {
    if (params.get("new") === "1") setCreating(true);
  }, [params]);

  return (
    <>
      <PageHeader
        title={pages.rooms.title}
        action={
          <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => setCreating(true)}>
            {copy.start}
          </Button>
        }
      />
      {mine.isPending ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (mine.data?.rooms.length ?? 0) > 0 ? (
        <section aria-labelledby="mine-h" className="px-4 pt-6 md:px-6">
          <h2 id="mine-h" className="text-xl font-bold text-text">
            {copy.yours}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.data?.rooms.map((r) => (
              <MyRoom key={r.id} room={r} />
            ))}
          </ul>
        </section>
      ) : null}
      <RoomsExplorer
        bare
        hrefBase="/app/rooms"
        initialRooms={initialRooms}
        initialQuery=""
        initialFailed={initialFailed}
      />
      <CreateRoomModal open={creating} onOpenChange={setCreating} />
    </>
  );
}
