"use client";

import { BellRing, Lock } from "lucide-react";
import { LANGUAGE_LABELS, type RoomRole, type RoomDto } from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roomCopy as copy } from "@/content/rooms";
import { type PrejoinPrefs } from "@/lib/session/prefs";
import { PreJoin } from "../pre-join";
import { formatFull } from "@/lib/time";

/** What shows before you are inside: the room's details, the reminder or start button, or the check screen. */
export function RoomLobby({
  room,
  role,
  embedded,
  joining,
  reminding,
  meName,
  meAvatar,
  onToggleGoing,
  onStartNow,
  onJoin,
}: {
  room: RoomDto;
  role: RoomRole;
  embedded: boolean;
  joining: boolean;
  reminding: boolean;
  meName: string;
  meAvatar: string | null;
  onToggleGoing: (next: boolean) => Promise<void>;
  onStartNow: () => Promise<void>;
  onJoin: (prefs?: PrejoinPrefs) => Promise<void>;
}) {
  const scheduled = room.status === "SCHEDULED";
  const host = room.myRole === "HOST";
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-6 py-16 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {room.status === "LIVE" ? (
          <Badge tone="yellow">{copy.live}</Badge>
        ) : (
          <Badge>{copy.upcoming}</Badge>
        )}
        {room.visibility === "PRIVATE" ? (
          <Badge>
            <Lock aria-hidden className="mr-1 size-3" />
            {copy.create.private}
          </Badge>
        ) : null}
        {room.locked ? <Badge>{copy.stage.locked}</Badge> : null}
        <Badge>{room.media === "VIDEO" ? copy.create.video : copy.create.audio}</Badge>
        <span className="text-sm text-text-muted">{LANGUAGE_LABELS[room.language]}</span>
      </div>
      {embedded ? (
        <h2 className="text-3xl font-black tracking-tight text-text">{room.title}</h2>
      ) : (
        <h1 className="text-3xl font-black tracking-tight text-text">{room.title}</h1>
      )}
      {room.description ? <p className="max-w-prose text-text-muted">{room.description}</p> : null}
      <p className="flex items-center gap-2 text-text-muted">
        <Avatar name={room.host.name} src={room.host.avatarUrl} size={28} />
        {room.host.name}
      </p>
      <p className="tabular text-sm text-text-muted">
        {copy.stage.peopleOf(room.joined, room.max)}
      </p>
      {room.settings.joinMuted ? (
        <p className="text-sm text-text-muted">{copy.stage.joinMutedNote}</p>
      ) : null}
      {scheduled && room.scheduledFor ? (
        <p className="text-text">
          {copy.stage.startingSoon(formatFull(new Date(room.scheduledFor)))}
        </p>
      ) : null}
      {scheduled && !host ? (
        <div className="flex flex-col items-center gap-2">
          {room.going ? (
            <p className="flex items-center gap-2 font-semibold text-green-700">
              <BellRing aria-hidden className="size-4" />
              {copy.stage.goingTitle}
            </p>
          ) : null}
          <p className="max-w-sm text-sm text-text-muted">
            {room.going ? copy.stage.goingBody : copy.stage.waitingNote}
          </p>
          <Button
            className="min-h-12 px-10"
            variant={room.going ? "secondary" : "primary"}
            loading={reminding}
            onClick={() => void onToggleGoing(!room.going)}
          >
            {room.going ? copy.stage.notGoing : copy.stage.remindMe}
          </Button>
        </div>
      ) : scheduled ? (
        <Button className="min-h-12 px-10" loading={joining} onClick={() => void onStartNow()}>
          {joining ? copy.stage.joining : copy.stage.start}
        </Button>
      ) : (
        <PreJoin
          name={meName}
          avatarUrl={meAvatar}
          joining={joining}
          allowCamera={room.settings.cameraAllowed || role !== "MEMBER"}
          onJoin={(prefs) => void onJoin(prefs)}
        />
      )}
    </div>
  );
}
