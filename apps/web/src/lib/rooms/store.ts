import { create } from "zustand";
import type { RoomMemberState } from "@gistroom/shared";

export interface FloatingReaction {
  id: string;
  userId: string;
  emoji: string;
}

export type ModeratorNotice = "audio" | "video" | "all";

interface RoomState {
  /** Rooms the host ended while I was in them. */
  ended: Record<string, true>;
  /** I was removed or banned from these rooms. */
  kicked: Record<string, Extract<RoomMemberState, "REMOVED" | "BANNED">>;
  /** Reactions that are floating up right now, newest last. They remove themselves. */
  floating: Record<string, FloatingReaction[]>;
  /** A moderator muted me or turned my camera off. Shown once, then dismissed. */
  notice: Record<string, ModeratorNotice | undefined>;
  addReaction: (slug: string, userId: string, emoji: string) => void;
  dropReaction: (slug: string, id: string) => void;
  setNotice: (slug: string, notice: ModeratorNotice | undefined) => void;
  markEnded: (slug: string) => void;
  markKicked: (slug: string, state: "REMOVED" | "BANNED") => void;
}

/** Live room facts that arrive as socket hints. The rest of a room is fetched from the server. */
export const useRoomStore = create<RoomState>((set) => ({
  ended: {},
  kicked: {},
  floating: {},
  notice: {},
  addReaction: (slug, userId, emoji) =>
    set((s) => ({
      floating: {
        ...s.floating,
        [slug]: [
          ...(s.floating[slug] ?? []).slice(-24),
          { id: crypto.randomUUID(), userId, emoji },
        ],
      },
    })),
  dropReaction: (slug, id) =>
    set((s) => ({
      floating: { ...s.floating, [slug]: (s.floating[slug] ?? []).filter((r) => r.id !== id) },
    })),
  setNotice: (slug, notice) => set((s) => ({ notice: { ...s.notice, [slug]: notice } })),
  markEnded: (slug) => set((s) => ({ ended: { ...s.ended, [slug]: true } })),
  markKicked: (slug, state) => set((s) => ({ kicked: { ...s.kicked, [slug]: state } })),
}));
