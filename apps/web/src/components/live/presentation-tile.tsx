"use client";

import { useEffect, useRef, useState } from "react";
import type { Participant } from "livekit-client";
import {
  CameraOff,
  EyeOff,
  Maximize,
  MicOff,
  MonitorOff,
  Pin,
  PinOff,
  Presentation,
} from "lucide-react";
import { presentCopy as copy } from "@/content/present";
import { roomCopy } from "@/content/rooms";
import { cn } from "@/lib/cn";
import type { Presenter } from "@/lib/live/use-presenter";

/**
 * Someone else's shared screen, as a stage tile. It shows who presents, a "Presenting" status, and the presenter's mic
 * and camera as separate states. Viewers can enlarge (pin) it, go full screen or hide it for themselves. The video is
 * attached only while the tile shows, so a hidden or off screen tile does not keep pulling data. Never drawn for the
 * presenter's own screen: that would repeat itself without end.
 */
export function PresentationTile({
  participant,
  version,
  p,
  pinned,
  onTogglePin,
  className,
}: {
  participant: Participant;
  version: number;
  p: Presenter;
  pinned: boolean;
  onTogglePin?: () => void;
  className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const name = participant.name || participant.identity;

  useEffect(() => {
    const el = video.current;
    if (!el || hidden) return;
    let cancelled = false;
    let detach: (() => void) | undefined;
    void import("livekit-client").then((lk) => {
      if (cancelled) return;
      const track = participant.getTrackPublication(lk.Track.Source.ScreenShare)?.track;
      if (track) {
        track.attach(el);
        detach = () => track.detach(el);
      }
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [participant, version, hidden]);

  const fullscreen = () => {
    try {
      void frame.current?.requestFullscreen?.();
    } catch {
      // Full screen is a convenience. The enlarged tile still works without it.
    }
  };

  return (
    <div
      ref={frame}
      className={cn(
        "relative flex min-h-40 flex-col overflow-hidden rounded-card bg-ink-950 text-white ring-2 ring-yellow-400",
        className,
      )}
    >
      {hidden ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <EyeOff aria-hidden className="size-8" />
          <p className="font-semibold">{copy.live.hiddenTitle(name)}</p>
          <button
            type="button"
            onClick={() => setHidden(false)}
            className="min-h-11 rounded-full bg-yellow-400 px-5 text-sm font-semibold text-ink-950"
          >
            {copy.live.show}
          </button>
        </div>
      ) : (
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          aria-label={copy.live.screenOf(name)}
          className="min-h-0 w-full flex-1 bg-ink-950 object-contain"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 bg-ink-950/80 px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Presentation aria-hidden className="size-4 shrink-0" />
          <span className="truncate font-semibold">{copy.live.presenting(name)}</span>
          <span className="shrink-0 rounded-full bg-yellow-400 px-2 py-0.5 text-[0.6875rem] font-bold text-ink-950">
            {copy.live.badge}
          </span>
          {participant.isMicrophoneEnabled ? null : (
            <MicOff aria-label={roomCopy.stage.muted} className="size-4 shrink-0 text-white/90" />
          )}
          {participant.isCameraEnabled ? null : (
            <CameraOff
              aria-label={roomCopy.stage.cameraIsOff}
              className="size-4 shrink-0 text-white/90"
            />
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {onTogglePin ? (
            <TileButton
              label={pinned ? copy.live.unpin : copy.live.pin}
              pressed={pinned}
              onClick={onTogglePin}
            >
              {pinned ? (
                <PinOff aria-hidden className="size-5" />
              ) : (
                <Pin aria-hidden className="size-5" />
              )}
            </TileButton>
          ) : null}
          <TileButton label={copy.live.fullscreen} onClick={fullscreen}>
            <Maximize aria-hidden className="size-5" />
          </TileButton>
          <TileButton label={copy.live.hide} onClick={() => setHidden(true)}>
            <EyeOff aria-hidden className="size-5" />
          </TileButton>
          {p.rules.canForceStop ? (
            <TileButton label={copy.live.stopForEveryone} onClick={() => p.setForceStopOpen(true)}>
              <MonitorOff aria-hidden className="size-5" />
            </TileButton>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function TileButton({
  label,
  children,
  onClick,
  pressed,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-full transition-colors",
        pressed ? "bg-yellow-400 text-ink-950" : "bg-white/15 hover:bg-white/25",
      )}
    >
      {children}
    </button>
  );
}
