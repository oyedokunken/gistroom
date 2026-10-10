"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationDto, MessageDto } from "@gistroom/shared";
import { ApiClientError, apiFetch } from "@/lib/api";
import { upsertMessage, type CachedMessages, type CachedPage } from "./cache";
import { isRetryable, nextToSend } from "./outbox";
import { useOutbox } from "./outbox-store";

export const keys = {
  conversations: (archived: boolean) => ["conversations", archived] as const,
  messages: (id: string) => ["messages", id] as const,
  friends: ["friends"] as const,
  requests: (direction: string) => ["requests", direction] as const,
  notifications: (unreadOnly: boolean) => ["notifications", unreadOnly] as const,
};

export function useConversations(archived = false) {
  return useQuery({
    queryKey: keys.conversations(archived),
    queryFn: () =>
      apiFetch<{ conversations: ConversationDto[]; archivedUnread: number }>(
        `/api/conversations${archived ? "?archived=1" : ""}`,
      ),
  });
}

/** Newest page first. fetchNextPage loads older history as you scroll up. */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(conversationId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<CachedPage>(
        `/api/conversations/${conversationId}/messages${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
}

/**
 * Flushes the outbox: one message at a time per chat, oldest first, retrying on the network and giving up on 4xx.
 * Mounted once in the app shell. The server copy replaces the optimistic one by clientId.
 */
export function useOutboxFlusher(online: boolean) {
  const queryClient = useQueryClient();
  const queue = useOutbox((s) => s.queue);
  const hydrated = useOutbox((s) => s.hydrated);
  const busy = useRef(new Set<string>());

  useEffect(() => {
    void useOutbox.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!online || !hydrated) return;
    let cancelled = false;

    async function pump() {
      for (;;) {
        const state = useOutbox.getState();
        const item = nextToSend(state.queue, busy.current);
        if (!item || cancelled) return;
        busy.current.add(item.conversationId);
        state.setStatus(item.clientId, "sending");
        try {
          const res = await apiFetch<{ message: MessageDto }>(
            `/api/conversations/${item.conversationId}/messages`,
            {
              body: { clientId: item.clientId, body: item.body, replyToId: item.replyToId },
            },
          );
          queryClient.setQueryData<{ pages: CachedPage[]; pageParams: unknown[] }>(
            keys.messages(item.conversationId),
            (cache) => upsertMessage(cache as CachedMessages | undefined, res.message),
          );
          void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          useOutbox.getState().drop(item.clientId);
        } catch (e) {
          const status = e instanceof ApiClientError ? e.status : 0;
          useOutbox
            .getState()
            .setStatus(
              item.clientId,
              isRetryable(status) && item.attempts < 3 ? "queued" : "failed",
            );
          if (isRetryable(status)) {
            // Back off before the next try so a down server is not hammered.
            await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** item.attempts)));
          }
        } finally {
          busy.current.delete(item.conversationId);
        }
      }
    }
    void pump();
    return () => {
      cancelled = true;
    };
  }, [online, hydrated, queue, queryClient]);
}
