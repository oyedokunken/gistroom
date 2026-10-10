import { create } from "zustand";
import type { RoomMemberState } from "@gistroom/shared";

interface RoomState {
  /** Rooms the host ended while I was in them. */
  ended: Record<string, true>;
  /** I was removed or banned from these rooms. */
  kicked: Record<string, Extract<RoomMemberState, "REMOVED" | "BANNED">>;
  markEnded: (slug: string) => void;
  markKicked: (slug: string, state: "REMOVED" | "BANNED") => void;
}

/** Live room facts that arrive as socket hints. The rest of a room is fetched from the server. */
export const useRoomStore = create<RoomState>((set) => ({
  ended: {},
  kicked: {},
  markEnded: (slug) => set((s) => ({ ended: { ...s.ended, [slug]: true } })),
  markKicked: (slug, state) => set((s) => ({ kicked: { ...s.kicked, [slug]: state } })),
}));
