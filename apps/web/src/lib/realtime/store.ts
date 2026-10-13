"use client";

import { create } from "zustand";

export type Connection = "connecting" | "online" | "reconnecting" | "offline";

interface PresenceInfo {
  online: boolean;
  lastSeenAt: string | null;
}

interface RealtimeState {
  connection: Connection;
  presence: Record<string, PresenceInfo>;
  /** conversationId to the people typing there. */
  typing: Record<string, string[]>;
  /** The chat the person is looking at right now, so new messages there count as read. */
  openConversationId: string | null;
  setConnection: (c: Connection) => void;
  setPresence: (userId: string, info: PresenceInfo) => void;
  setTyping: (conversationId: string, userId: string, on: boolean) => void;
  setOpenConversation: (id: string | null) => void;
  reset: () => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Ephemeral live state: connection, who is online, who is typing. Server state lives in TanStack Query. */
export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  connection: "connecting",
  presence: {},
  typing: {},
  openConversationId: null,
  setConnection: (connection) => set({ connection }),
  setPresence: (userId, info) => set((s) => ({ presence: { ...s.presence, [userId]: info } })),
  setTyping: (conversationId, userId, on) => {
    const key = `${conversationId}:${userId}`;
    clearTimeout(timers.get(key));
    const current = get().typing[conversationId] ?? [];
    const without = current.filter((u) => u !== userId);
    set((s) => ({
      typing: { ...s.typing, [conversationId]: on ? [...without, userId] : without },
    }));
    // A lost typing:stop must not leave the indicator stuck.
    if (on) {
      timers.set(
        key,
        setTimeout(() => get().setTyping(conversationId, userId, false), 5000),
      );
    }
  },
  setOpenConversation: (openConversationId) => set({ openConversationId }),
  reset: () =>
    set({ connection: "connecting", presence: {}, typing: {}, openConversationId: null }),
}));
