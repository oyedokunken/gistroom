"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Participant, Room } from "livekit-client";

export interface RoomLiveKit {
  /** Everyone in the room, you first. The objects are LiveKit participants, used to attach video. */
  participants: Participant[];
  speaking: ReadonlySet<string>;
  connected: boolean;
  reconnecting: boolean;
  micOn: boolean;
  camOn: boolean;
  /** Joined from somewhere else, so this connection was closed (one seat per person). */
  replaced: boolean;
  failed: boolean;
  micBlocked: boolean;
  /** Bumps on every change so tiles re-attach tracks. */
  version: number;
  toggleMic: () => Promise<void>;
  setCamera: (on: boolean) => Promise<"ok" | "blocked">;
  leave: () => void;
  audioHost: React.RefObject<HTMLDivElement | null>;
}

/** Joins one room on LiveKit and keeps a simple list of who is there, who is speaking and who has video. */
export function useRoomLiveKit(args: {
  url: string | null;
  token: string | null;
  lowData: boolean;
  /** The room asked everyone to arrive muted. */
  startMuted?: boolean;
}): RoomLiveKit {
  const { url, token, lowData, startMuted } = args;
  const roomRef = useRef<Room | null>(null);
  const audioHost = useRef<HTMLDivElement | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [speaking, setSpeaking] = useState<ReadonlySet<string>>(new Set());
  const [flags, setFlags] = useState({
    connected: false,
    reconnecting: false,
    micOn: false,
    camOn: false,
    replaced: false,
    failed: false,
    micBlocked: false,
  });
  const [version, setVersion] = useState(0);

  const sync = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const lp = room.localParticipant;
    setParticipants([lp, ...room.remoteParticipants.values()]);
    setFlags((f) => ({ ...f, micOn: lp.isMicrophoneEnabled, camOn: lp.isCameraEnabled }));
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!url || !token) return;
    let cancelled = false;
    let room: Room | null = null;
    const host = audioHost.current;

    (async () => {
      const lk = await import("livekit-client");
      if (cancelled) return;
      room = new lk.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: lowData ? lk.VideoPresets.h360.resolution : lk.VideoPresets.h540.resolution,
        },
        publishDefaults: { simulcast: true },
      });
      roomRef.current = room;

      room.on(lk.RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === lk.Track.Kind.Audio) host?.appendChild(track.attach());
        sync();
      });
      room.on(lk.RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        sync();
      });
      for (const ev of [
        lk.RoomEvent.ParticipantConnected,
        lk.RoomEvent.ParticipantDisconnected,
        lk.RoomEvent.TrackMuted,
        lk.RoomEvent.TrackUnmuted,
        lk.RoomEvent.TrackPublished,
        lk.RoomEvent.TrackUnpublished,
        lk.RoomEvent.LocalTrackPublished,
        lk.RoomEvent.LocalTrackUnpublished,
      ]) {
        room.on(ev, sync);
      }
      room.on(lk.RoomEvent.ActiveSpeakersChanged, (list) =>
        setSpeaking(new Set(list.map((p) => p.identity))),
      );
      room.on(lk.RoomEvent.Reconnecting, () => setFlags((f) => ({ ...f, reconnecting: true })));
      room.on(lk.RoomEvent.Reconnected, () => setFlags((f) => ({ ...f, reconnecting: false })));
      room.on(lk.RoomEvent.Disconnected, (reason) =>
        setFlags((f) => ({
          ...f,
          connected: false,
          reconnecting: false,
          replaced: reason === lk.DisconnectReason.DUPLICATE_IDENTITY ? true : f.replaced,
        })),
      );

      try {
        await room.connect(url, token);
        if (cancelled) return;
        setFlags((f) => ({ ...f, connected: true, failed: false }));
        try {
          if (!startMuted) await room.localParticipant.setMicrophoneEnabled(true);
        } catch {
          setFlags((f) => ({ ...f, micBlocked: true }));
        }
        sync();
      } catch {
        if (!cancelled) setFlags((f) => ({ ...f, failed: true }));
      }
    })();

    return () => {
      cancelled = true;
      room?.disconnect();
      roomRef.current = null;
      host?.replaceChildren();
      setParticipants([]);
    };
    // One connection per token. A later prop change must not reconnect.
  }, [url, token]);

  const toggleMic = useCallback(async () => {
    const lp = roomRef.current?.localParticipant;
    if (!lp) return;
    await lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled);
    sync();
  }, [sync]);

  const setCamera = useCallback(
    async (on: boolean) => {
      const lp = roomRef.current?.localParticipant;
      if (!lp) return "blocked" as const;
      try {
        await lp.setCameraEnabled(on);
        sync();
        return "ok" as const;
      } catch {
        sync();
        return "blocked" as const;
      }
    },
    [sync],
  );

  const leave = useCallback(() => roomRef.current?.disconnect(), []);

  return { participants, speaking, ...flags, version, toggleMic, setCamera, leave, audioHost };
}
