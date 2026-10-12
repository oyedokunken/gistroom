"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CameraOff, MicOff } from "lucide-react";
import type { Participant } from "livekit-client";
import { Avatar } from "@/components/ui/avatar";
import { roomCopy } from "@/content/rooms";
import { cn } from "@/lib/cn";
import type { FloatingReaction } from "@/lib/rooms/store";

/**
 * One person on the stage. A green ring and the word Speaking show who has the floor, so it is never colour alone
 * (R19). Video is attached only while the camera is on. Without video the person's avatar fills the tile.
 */
export function ParticipantTile({
  participant,
  speaking,
  roleLabel,
  version,
  avatarUrl,
  reactions,
  onReactionDone,
}: {
  participant: Participant;
  speaking: boolean;
  roleLabel: string | null;
  version: number;
  avatarUrl: string | null;
  reactions: readonly FloatingReaction[];
  onReactionDone: (id: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const hasVideo = participant.isCameraEnabled;
  const name = participant.name || participant.identity;

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    let detach: (() => void) | undefined;
    void import("livekit-client").then((lk) => {
      const track = participant.getTrackPublication(lk.Track.Source.Camera)?.track;
      if (track && hasVideo) {
        track.attach(el);
        detach = () => track.detach(el);
      }
    });
    return () => detach?.();
  }, [participant, hasVideo, version]);

  return (
    <li
      className={cn(
        "relative flex aspect-[4/3] min-h-32 flex-col items-center justify-center overflow-hidden rounded-card bg-ink-700 text-white",
        speaking && "ring-4 ring-green-600",
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live camera has no caption track */}
      <video
        ref={video}
        autoPlay
        playsInline
        muted={participant.isLocal}
        aria-label={name}
        className={cn("absolute inset-0 size-full object-cover", hasVideo ? "block" : "hidden")}
      />
      {hasVideo ? null : <Avatar name={name} src={avatarUrl} size={80} speaking={speaking} />}

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-10 top-0">
        <AnimatePresence>
          {reactions.map((r, i) => (
            <motion.span
              key={r.id}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.7 }}
              animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: -90, scale: 1.1 }}
              transition={{ duration: reduced ? 1.6 : 2.2, ease: "easeOut" }}
              onAnimationComplete={() => onReactionDone(r.id)}
              className="absolute bottom-0 text-3xl"
              style={{ left: `${18 + ((i * 23) % 64)}%` }}
            >
              {r.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-ink-950/70 px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-1.5">
          {participant.isMicrophoneEnabled ? null : (
            <MicOff aria-label={roomCopy.stage.muted} className="size-4 shrink-0 text-white/90" />
          )}
          {hasVideo ? null : (
            <CameraOff
              aria-label={roomCopy.stage.cameraIsOff}
              className="size-4 shrink-0 text-white/90"
            />
          )}
          <span className="truncate font-semibold">
            {participant.isLocal ? `${name} (${roomCopy.stage.you})` : name}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {roleLabel ? (
            <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[0.6875rem] font-bold text-ink-950">
              {roleLabel}
            </span>
          ) : null}
          {speaking ? (
            <span className="text-xs font-semibold">{roomCopy.stage.speaking}</span>
          ) : null}
        </span>
      </div>
    </li>
  );
}
