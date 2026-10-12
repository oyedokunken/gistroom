"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { isReactionEmoji } from "@gistroom/shared";

const REACTION_TOPIC = "reaction";

export interface LiveKitState {
  connected: boolean;
  reconnecting: boolean;
  micOn: boolean;
  camOn: boolean;
  remoteCam: boolean;
  /** True after the local connection stayed poor for 10 seconds (Section 9.4). */
  poorFor10s: boolean;
  micBlocked: boolean;
  failed: boolean;
}

const initial: LiveKitState = {
  connected: false,
  reconnecting: false,
  micOn: false,
  camOn: false,
  remoteCam: false,
  poorFor10s: false,
  micBlocked: false,
  failed: false,
};

export type CameraResult = "ok" | "blocked";

/**
 * Joins one LiveKit room for a 1:1 call. Audio always goes first. Video is switched on and off with
 * setCameraEnabled on the same room, so switching never reconnects (Section 9.4).
 */
export function useLiveKit(args: {
  url: string | null;
  token: string | null;
  /** Start with the camera on. Data saver turns this off. */
  startWithVideo: boolean;
  /** Hold video at 360p when data saver is on. */
  lowData: boolean;
  /** Called when the other person sends a reaction over the call. */
  onReaction?: (emoji: string) => void;
}) {
  const { url, token, startWithVideo, lowData } = args;
  const onReactionRef = useRef(args.onReaction);
  onReactionRef.current = args.onReaction;
  const [state, setState] = useState<LiveKitState>(initial);
  const roomRef = useRef<Room | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const audioHost = useRef<HTMLDivElement | null>(null);
  const poorTimer = useRef<number | undefined>(undefined);

  const sync = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const lp = room.localParticipant;
    setState((s) => ({
      ...s,
      micOn: lp.isMicrophoneEnabled,
      camOn: lp.isCameraEnabled,
      remoteCam: [...room.remoteParticipants.values()].some((p) => p.isCameraEnabled),
    }));
  }, []);

  useEffect(() => {
    if (!url || !token) return;
    let cancelled = false;
    let room: Room | null = null;

    (async () => {
      const lk = await import("livekit-client");
      if (cancelled) return;
      room = new lk.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: lowData ? lk.VideoPresets.h360.resolution : lk.VideoPresets.h720.resolution,
        },
        publishDefaults: { simulcast: true },
      });
      roomRef.current = room;

      room.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === lk.Track.Kind.Video) {
          if (remoteVideo.current) track.attach(remoteVideo.current);
        } else if (track.kind === lk.Track.Kind.Audio) {
          const el = track.attach();
          audioHost.current?.appendChild(el);
        }
        sync();
      });
      room.on(lk.RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        sync();
      });
      for (const ev of [
        lk.RoomEvent.TrackMuted,
        lk.RoomEvent.TrackUnmuted,
        lk.RoomEvent.LocalTrackPublished,
        lk.RoomEvent.LocalTrackUnpublished,
        lk.RoomEvent.TrackPublished,
        lk.RoomEvent.TrackUnpublished,
        lk.RoomEvent.ParticipantConnected,
        lk.RoomEvent.ParticipantDisconnected,
      ]) {
        room.on(ev, sync);
      }
      room.on(lk.RoomEvent.LocalTrackPublished, (pub) => {
        if (pub.source === lk.Track.Source.Camera && pub.track && localVideo.current) {
          pub.track.attach(localVideo.current);
        }
      });
      room.on(lk.RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        if (!participant.isLocal) return;
        const poor = quality === lk.ConnectionQuality.Poor || quality === lk.ConnectionQuality.Lost;
        window.clearTimeout(poorTimer.current);
        if (!poor) {
          setState((s) => (s.poorFor10s ? { ...s, poorFor10s: false } : s));
          return;
        }
        poorTimer.current = window.setTimeout(
          () => setState((s) => ({ ...s, poorFor10s: true })),
          10_000,
        );
      });
      room.on(lk.RoomEvent.DataReceived, (payload, _from, _kind, topic) => {
        if (topic !== REACTION_TOPIC) return;
        const emoji = new TextDecoder().decode(payload);
        if (isReactionEmoji(emoji)) onReactionRef.current?.(emoji);
      });
      room.on(lk.RoomEvent.Reconnecting, () => setState((s) => ({ ...s, reconnecting: true })));
      room.on(lk.RoomEvent.Reconnected, () => setState((s) => ({ ...s, reconnecting: false })));
      room.on(lk.RoomEvent.Disconnected, () =>
        setState((s) => ({ ...s, connected: false, reconnecting: false })),
      );

      try {
        await room.connect(url, token);
        if (cancelled) return;
        setState((s) => ({ ...s, connected: true, failed: false }));
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch {
          setState((s) => ({ ...s, micBlocked: true }));
        }
        if (startWithVideo) {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch {
            // Camera refused: stay in audio. The screen explains how to allow it.
          }
        }
        sync();
      } catch {
        if (!cancelled) setState((s) => ({ ...s, failed: true }));
      }
    })();

    const host = audioHost.current;
    return () => {
      cancelled = true;
      window.clearTimeout(poorTimer.current);
      room?.disconnect();
      roomRef.current = null;
      host?.replaceChildren();
      setState(initial);
    };
    // The call is joined once per token. Later prop changes must not reconnect.
  }, [url, token]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    sync();
  }, [sync]);

  const setCamera = useCallback(
    async (on: boolean): Promise<CameraResult> => {
      const room = roomRef.current;
      if (!room) return "blocked";
      try {
        await room.localParticipant.setCameraEnabled(on);
        sync();
        return "ok";
      } catch {
        sync();
        return "blocked";
      }
    },
    [sync],
  );

  const flipCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const lk = await import("livekit-client");
    const cams = await lk.Room.getLocalDevices("videoinput");
    if (cams.length < 2) return;
    const current = room.getActiveDevice("videoinput");
    const next = cams.find((c) => c.deviceId !== current) ?? cams[0];
    if (next) await room.switchActiveDevice("videoinput", next.deviceId);
  }, []);

  /** Floats a reaction for the other person. Lossy delivery is fine, so a burst never queues up. */
  const sendReaction = useCallback(async (emoji: string) => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant
      .publishData(new TextEncoder().encode(emoji), { reliable: false, topic: REACTION_TOPIC })
      .catch(() => undefined);
  }, []);

  const leave = useCallback(() => {
    roomRef.current?.disconnect();
  }, []);

  return {
    state,
    toggleMic,
    setCamera,
    flipCamera,
    sendReaction,
    leave,
    remoteVideo,
    localVideo,
    audioHost,
  };
}
