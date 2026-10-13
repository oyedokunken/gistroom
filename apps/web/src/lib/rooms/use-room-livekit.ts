"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Participant } from "livekit-client";
import { live, useLive } from "@/lib/live/live-session";

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
  sendReaction: (emoji: string) => Promise<void>;
  leave: () => void;
  audioHost: React.RefObject<HTMLDivElement | null>;
}

const NONE: Participant[] = [];

/**
 * The room screen's view of the live session. The connection belongs to the tab, so opening chats or settings while you
 * are in a room never drops you. Leaving is always an explicit action.
 */
export function useRoomLiveKit(args: {
  slug: string;
  title: string;
  url: string | null;
  token: string | null;
  lowData: boolean;
  /** The room asked everyone to arrive muted. */
  startMuted?: boolean;
  hangUp: () => Promise<void>;
  heartbeat: () => void;
  beacon: () => void;
}): RoomLiveKit {
  const { slug, title, url, token, lowData, startMuted } = args;
  const latest = useRef(args);
  latest.current = args;
  const store = useLive();
  const mine = store.refId === slug;

  useEffect(() => {
    if (!url || !token) return;
    void live().join({
      kind: "room",
      refId: slug,
      title,
      url,
      token,
      lowData,
      startMuted,
      hangUp: () => latest.current.hangUp(),
      heartbeat: () => latest.current.heartbeat(),
      beacon: () => latest.current.beacon(),
    });
    // One connection per room. A later prop change must not reconnect.
  }, [slug, url, token]);

  const leave = useCallback(() => {
    if (live().isFor(slug)) live().leave();
  }, [slug]);

  return {
    participants: mine ? store.participants : NONE,
    speaking: mine ? store.speaking : new Set(),
    connected: mine && store.status === "connected",
    reconnecting: mine && store.status === "reconnecting",
    micOn: mine && store.micOn,
    camOn: mine && store.camOn,
    replaced: mine && store.disconnectReason === "duplicate",
    failed: mine && store.status === "failed",
    micBlocked: mine && store.micIssue !== null,
    version: store.version,
    toggleMic: () => live().toggleMic(),
    setCamera: (on) => live().setCamera(on),
    sendReaction: (emoji) => live().sendReaction(emoji),
    leave,
    audioHost: useRef<HTMLDivElement | null>(null),
  };
}
