"use client";

import { Lock, LockOpen, ShieldAlert, VolumeX } from "lucide-react";
import { roomAvatarSrc, type RoomRole, type RoomDto } from "@gistroom/shared";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { roomCopy as copy } from "@/content/rooms";
import { session as sessionCopy } from "@/content/session";
import { SignalBars } from "@/components/session/signal-bars";
import { type QualityLabel } from "@/lib/live/live-session";
import { type ModeratorNotice as ModeratorNoticeKind } from "@/lib/rooms/store";

/** The title bar: the room, how many are in it, the signal, and the lock, mute all and end buttons for those who may. */
export function StageHeader({
  room,
  role,
  count,
  localQuality,
  canMod,
  onToggleLock,
  onMuteAll,
  onEnd,
}: {
  room: RoomDto;
  role: RoomRole;
  count: number;
  localQuality: QualityLabel;
  canMod: boolean;
  onToggleLock: () => Promise<void>;
  onMuteAll: () => void;
  onEnd: () => Promise<void>;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
      <Avatar name={room.title} src={roomAvatarSrc(room.topicSlug)} size={44} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold">{room.title}</h1>
        <p className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
          <span>{copy.stage.people(count)}</span>
          <SignalBars quality={localQuality} showLabel />
          {room.locked ? (
            <span className="inline-flex items-center gap-1">
              <Lock aria-hidden className="size-3.5" />
              {copy.stage.locked}
            </span>
          ) : null}
        </p>
      </div>
      {canMod ? (
        <>
          <Tooltip content={room.locked ? copy.stage.unlock : copy.stage.lockHint}>
            <button
              type="button"
              onClick={() => void onToggleLock()}
              aria-label={room.locked ? copy.stage.unlock : copy.stage.lock}
              className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              {room.locked ? (
                <LockOpen aria-hidden className="size-5" />
              ) : (
                <Lock aria-hidden className="size-5" />
              )}
            </button>
          </Tooltip>
          <Tooltip content={copy.stage.muteAll}>
            <button
              type="button"
              onClick={() => onMuteAll()}
              aria-label={copy.stage.muteAll}
              className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <VolumeX aria-hidden className="size-5" />
            </button>
          </Tooltip>
        </>
      ) : null}
      {role === "HOST" ? (
        <Button variant="danger" onClick={() => void onEnd()}>
          {copy.stage.end}
        </Button>
      ) : null}
    </header>
  );
}

/** A moderator muted you, or everyone, or turned your camera off. Said once, in plain words, with a way to dismiss. */
export function ModeratorNotice({
  room,
  notice,
  onUnmute,
  onDismiss,
}: {
  room: RoomDto;
  notice: ModeratorNoticeKind | undefined;
  onUnmute: () => void;
  onDismiss: () => void;
}) {
  if (!notice) return null;
  const noticeText =
    notice === "all"
      ? copy.stage.mutedAllByModerator
      : notice === "video"
        ? copy.stage.cameraMutedByModerator
        : copy.stage.mutedByModerator;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 bg-yellow-400 px-4 py-2 text-sm font-semibold text-ink-950"
    >
      <ShieldAlert aria-hidden className="size-4 shrink-0" />
      <span>{noticeText}</span>
      {notice !== "video" && !room.settings.unmuteLocked ? (
        <button
          type="button"
          onClick={onUnmute}
          className="min-h-11 rounded-full bg-ink-950 px-4 text-white"
        >
          {sessionCopy.controls.unmute}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-11 rounded-full px-3 underline underline-offset-4"
      >
        {copy.stage.gotIt}
      </button>
    </div>
  );
}
