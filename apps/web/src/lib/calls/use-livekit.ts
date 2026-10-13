"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { live, useLive } from "@/lib/live/live-session";

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

export type CameraResult = "ok" | "blocked";

/**
 * The call screen's view of the live session. The connection itself belongs to the tab, not to this screen, so leaving
 * the screen never hangs up. Audio goes first. Video is switched on and off on the same room, so switching never
 * reconnects (Section 9.4).
 */
export function useLiveKit(args: {
  callId: string;
  title: string;
  url: string | null;
  token: string | null;
  /** Start with the camera on. Data saver turns this off. */
  startWithVideo: boolean;
  /** Hold video at 360p when data saver is on. */
  lowData: boolean;
  /** Arrive with the microphone off. */
  startMuted?: boolean;
  /** Ends the call on the server, for the in-call bar. */
  hangUp: () => Promise<void>;
  heartbeat: () => void;
  beacon: () => void;
}) {
  const { callId, title, url, token, startWithVideo, lowData, startMuted } = args;
  const latest = useRef(args);
  latest.current = args;
  const store = useLive();
  const mine = store.refId === callId;

  useEffect(() => {
    if (!url || !token) return;
    void live().join({
      kind: "call",
      refId: callId,
      title,
      url,
      token,
      startWithVideo,
      lowData,
      startMuted,
      hangUp: () => latest.current.hangUp(),
      heartbeat: () => latest.current.heartbeat(),
      beacon: () => latest.current.beacon(),
    });
    // The call is joined once. Later changes (a fresh token, a changed name) must not reconnect.
  }, [callId, url, token]);

  const state: LiveKitState = useMemo(
    () => ({
      connected: mine && store.status === "connected",
      reconnecting: mine && store.status === "reconnecting",
      micOn: mine && store.micOn,
      camOn: mine && store.camOn,
      remoteCam: mine && store.remoteCam,
      poorFor10s: mine && store.poorFor10s,
      micBlocked: mine && store.micIssue !== null,
      failed: mine && store.status === "failed",
    }),
    [
      mine,
      store.status,
      store.micOn,
      store.camOn,
      store.remoteCam,
      store.poorFor10s,
      store.micIssue,
    ],
  );

  const remoteVideo = useCallback(
    (el: HTMLVideoElement | null) => live().attachVideo("remote", el),
    [],
  );
  const localVideo = useCallback(
    (el: HTMLVideoElement | null) => live().attachVideo("local", el),
    [],
  );
  const audioHost = useRef<HTMLDivElement | null>(null);

  return {
    state,
    toggleMic: () => live().toggleMic(),
    setCamera: (on: boolean): Promise<CameraResult> => live().setCamera(on),
    flipCamera: () => live().flipCamera(),
    sendReaction: (emoji: string) => live().sendReaction(emoji),
    leave: () => {
      if (live().isFor(callId)) live().leave();
    },
    remoteVideo,
    localVideo,
    audioHost,
  };
}
