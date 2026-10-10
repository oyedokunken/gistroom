"use client";

import { create } from "zustand";
import { del, get, set } from "idb-keyval";
import {
  enqueue,
  markStatus,
  newClientId,
  nextToSend,
  recoverAfterReload,
  remove,
  retryFailed,
  type OutboxItem,
} from "./outbox";

const KEY = "gr-outbox-v1";

interface OutboxState {
  queue: OutboxItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (input: { conversationId: string; body: string; replyToId: string | null }) => OutboxItem;
  setStatus: (clientId: string, status: OutboxItem["status"]) => void;
  drop: (clientId: string) => void;
  retry: (conversationId?: string) => void;
  clear: () => Promise<void>;
}

/** Storage can be blocked (private windows). The queue then lives in memory for this visit only. */
async function persist(queue: OutboxItem[]) {
  try {
    await set(KEY, queue);
  } catch {
    // Not fatal: sends still work, they just do not survive a reload.
  }
}

/** Outgoing messages. Survives reloads in IndexedDB and flushes in order when the network returns (Section 9.3). */
export const useOutbox = create<OutboxState>((setState, getState) => ({
  queue: [],
  hydrated: false,
  async hydrate() {
    if (getState().hydrated) return;
    let stored: OutboxItem[] = [];
    try {
      stored = (await get<OutboxItem[]>(KEY)) ?? [];
    } catch {
      stored = [];
    }
    setState({ queue: recoverAfterReload(stored), hydrated: true });
  },
  add({ conversationId, body, replyToId }) {
    const clientId = newClientId();
    const createdAt = new Date().toISOString();
    const next = enqueue(getState().queue, {
      clientId,
      conversationId,
      body,
      replyToId,
      createdAt,
    });
    setState({ queue: next });
    void persist(next);
    return next.find((q) => q.clientId === clientId)!;
  },
  setStatus(clientId, status) {
    const next = markStatus(getState().queue, clientId, status);
    setState({ queue: next });
    void persist(next);
  },
  drop(clientId) {
    const next = remove(getState().queue, clientId);
    setState({ queue: next });
    void persist(next);
  },
  retry(conversationId) {
    const next = retryFailed(getState().queue, conversationId);
    setState({ queue: next });
    void persist(next);
  },
  async clear() {
    setState({ queue: [] });
    try {
      await del(KEY);
    } catch {
      // Nothing to clean up.
    }
  },
}));

export { nextToSend };
