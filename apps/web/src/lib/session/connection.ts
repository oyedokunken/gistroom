"use client";

import { create } from "zustand";
import type { NetState } from "./connection-machine";

export type LiveKitStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";
export type RealtimeNote = "connecting" | "slow" | null;

export interface ConnectionInfo {
  /** The debounced state screens react to. */
  state: NetState;
  /** When the state last changed, in milliseconds since 1970. */
  since: number;
  lastOnlineAt: number | null;
  /** Round trip of the last health check, in milliseconds. */
  rttMs: number | null;
  /** The health check answered with a server error. The device is online and Gistroom is not. */
  serverError: boolean;
  /** The chat connection. Chat still works over plain requests while this is down. */
  realtime: "connecting" | "online" | "reconnecting" | "offline";
  /** Set while the realtime service is down but the rest of Gistroom is up. */
  realtimeNote: RealtimeNote;
  livekit: LiveKitStatus;
  /** LiveKit reports a poor connection for me. */
  livekitPoor: boolean;
  /** The network type changed, for example from Wi-Fi to mobile data. */
  switchedAt: number | null;
}

interface ConnectionStore extends ConnectionInfo {
  patch: (change: Partial<ConnectionInfo>) => void;
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  state: "ONLINE",
  since: 0,
  lastOnlineAt: null,
  rttMs: null,
  serverError: false,
  realtime: "connecting",
  realtimeNote: null,
  livekit: "idle",
  livekitPoor: false,
  switchedAt: null,
  patch: (change) => set(change),
}));

/** One hook for chat, calls and rooms to read the connection. */
export function useConnection(): ConnectionInfo {
  return useConnectionStore();
}

/** Calls and rooms tell the monitor what LiveKit is doing, so the whole app can react to it. */
export function setLiveKitStatus(status: LiveKitStatus, poor = false): void {
  useConnectionStore.getState().patch({ livekit: status, livekitPoor: poor });
}

type Listener = (next: NetState, previous: NetState) => void;
const listeners = new Set<Listener>();

/** The modal manager and the sound manager listen here. Returns the way to stop listening. */
export function onNetState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitNetState(next: NetState, previous: NetState): void {
  for (const l of listeners) l(next, previous);
}
