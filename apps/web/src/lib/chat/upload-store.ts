import { create } from "zustand";

export type UploadKind = "IMAGE" | "VIDEO" | "VOICE" | "FILE";

export interface UploadItem {
  id: string;
  conversationId: string;
  kind: UploadKind;
  name: string;
  progress: number;
  status: "uploading" | "failed";
  error?: string;
  /** A local picture or clip, so the bubble shows what is being sent while it uploads. */
  previewUrl?: string;
  durationMs?: number;
  waveform?: number[];
}

interface UploadState {
  items: UploadItem[];
  add: (item: UploadItem) => void;
  patch: (id: string, change: Partial<UploadItem>) => void;
  drop: (id: string) => void;
}

/** Uploads in flight, shared so they stay in the thread when you switch chats. */
export const useUploadStore = create<UploadState>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  patch: (id, change) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...change } : i)) })),
  drop: (id) =>
    set((s) => {
      const gone = s.items.find((i) => i.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return { items: s.items.filter((i) => i.id !== id) };
    }),
}));
