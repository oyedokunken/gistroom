"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DraftState {
  drafts: Record<string, string>;
  set: (conversationId: string, text: string) => void;
  clear: (conversationId: string) => void;
}

/**
 * Unsent text per conversation, kept across reloads (Section 9.3). It is a per viewer convenience,
 * so localStorage is fine. Nothing secret lives here.
 */
export const useDrafts = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      set: (id, text) =>
        set((s) => {
          const next = { ...s.drafts };
          if (text) next[id] = text;
          else delete next[id];
          return { drafts: next };
        }),
      clear: (id) =>
        set((s) => {
          const next = { ...s.drafts };
          delete next[id];
          return { drafts: next };
        }),
    }),
    { name: "gr-drafts-v1", partialize: (s) => ({ drafts: s.drafts }) },
  ),
);
