import { create } from "zustand";
import type { CallDto } from "@gistroom/shared";

interface CallState {
  /** A call that is ringing for me. Cleared when it is answered, declined or runs out. */
  incoming: CallDto | null;
  /** The call screen that is open right now, so its ending can be told even without a live connection. */
  screenId: string | null;
  setScreen: (id: string | null) => void;
  /** The latest state of a call I am part of, kept fresh from socket events. */
  updates: Record<string, CallDto>;
  setIncoming: (call: CallDto | null) => void;
  /** A socket event moved a call on. Drops the ring if it was for that call. */
  update: (call: CallDto) => void;
}

/** Ephemeral live call state. The server is the source of truth, this only mirrors what sockets told us. */
export const useCallStore = create<CallState>((set) => ({
  incoming: null,
  screenId: null,
  setScreen: (screenId) => set({ screenId }),
  updates: {},
  setIncoming: (incoming) => set({ incoming }),
  update: (call) =>
    set((s) => ({
      updates: { ...s.updates, [call.id]: call },
      incoming: s.incoming?.id === call.id && call.status !== "RINGING" ? null : s.incoming,
    })),
}));
