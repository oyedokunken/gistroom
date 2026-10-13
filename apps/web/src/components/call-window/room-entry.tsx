"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoomScreen } from "@/components/room/room-screen";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { callWindow as copy } from "@/content/call-window";
import { openRoom, useCallWindow } from "@/lib/call-window/store";
import { roomApi } from "@/lib/rooms/api";

/**
 * `/app/rooms/{slug}` as a link. A room you may be in opens in the call window, over a quiet details page, so the
 * page behind keeps working. A room that has ended, one you may not enter, or a bad link shows its own page here,
 * because there is no call to float.
 */
export function RoomEntry({
  slug,
  invite,
  meId,
  meName,
  meAvatar,
  dataSaver,
}: {
  slug: string;
  invite: string | null;
  meId: string;
  meName: string;
  meAvatar: string | null;
  dataSaver: boolean;
}) {
  const view = useQuery({ queryKey: ["room", slug], queryFn: () => roomApi.view(slug, invite) });
  const showing = useCallWindow((s) => s.state.target?.id === slug && s.state.mode !== "HIDDEN");
  const opened = useRef(false);
  const room = view.data?.state === "OK" ? view.data.room : null;

  useEffect(() => {
    if (!room || opened.current || showing) return;
    opened.current = true;
    openRoom(slug, { invite });
  }, [room, slug, invite, showing]);

  if (!room) {
    return (
      <RoomScreen
        slug={slug}
        invite={invite}
        meId={meId}
        meName={meName}
        meAvatar={meAvatar}
        dataSaver={dataSaver}
      />
    );
  }
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {room.status === "LIVE" ? (
          <Badge tone="yellow">{copy.live}</Badge>
        ) : (
          <Badge>{copy.upcoming}</Badge>
        )}
      </div>
      <h1 className="text-3xl font-black tracking-tight text-text">{room.title}</h1>
      <p className="flex items-center gap-2 text-text-muted">
        <Avatar name={room.host.name} src={room.host.avatarUrl} size={28} />
        {room.host.name}
      </p>
      <h2 className="text-lg font-bold text-text">{copy.detailsHeading}</h2>
      <p className="text-text-muted">{copy.detailsBody}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => openRoom(slug, { invite })}>{copy.detailsOpen}</Button>
        <Link href="/app/discover" className={buttonStyles("secondary")}>
          {copy.detailsBack}
        </Link>
      </div>
    </div>
  );
}
