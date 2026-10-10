import type { ConversationDto, MessageDto } from "@gistroom/shared";

/** Shape of one cached page from GET /api/conversations/:id/messages. Newest message first. */
export interface CachedPage {
  items: MessageDto[];
  nextCursor: string | null;
  peer: {
    id: string;
    deliveredAt: string | null;
    readAt: string | null;
    sendsReadReceipts: boolean;
  };
}

export interface CachedMessages {
  pages: CachedPage[];
  pageParams: unknown[];
}

/**
 * Insert or replace a message in the newest page. Matches on id first and on clientId second, so the server copy
 * replaces the optimistic one without a flicker or a duplicate (Section 9.3).
 */
export function upsertMessage(
  cache: CachedMessages | undefined,
  message: MessageDto,
): CachedMessages | undefined {
  if (!cache || cache.pages.length === 0) return cache;
  const pages = cache.pages.map((page) => ({ ...page, items: [...page.items] }));
  for (const page of pages) {
    const at = page.items.findIndex(
      (m) =>
        m.id === message.id || (m.senderId === message.senderId && m.clientId === message.clientId),
    );
    if (at !== -1) {
      page.items[at] = message;
      return { ...cache, pages };
    }
  }
  const first = pages[0];
  if (!first) return cache;
  // Keep newest first even if events arrive out of order.
  const idx = first.items.findIndex((m) => m.createdAt <= message.createdAt);
  first.items.splice(idx === -1 ? first.items.length : idx, 0, message);
  return { ...cache, pages };
}

/** Move the other person's delivered or read cursor forward. Cursors never move back. */
export function advancePeerCursor(
  cache: CachedMessages | undefined,
  kind: "delivered" | "read",
  messageCreatedAt: string,
): CachedMessages | undefined {
  if (!cache) return cache;
  const pages = cache.pages.map((page) => {
    const field = kind === "read" ? "readAt" : "deliveredAt";
    const current = page.peer[field];
    if (current && current >= messageCreatedAt) return page;
    return { ...page, peer: { ...page.peer, [field]: messageCreatedAt } };
  });
  return { ...cache, pages };
}

export function findMessage(cache: CachedMessages | undefined, id: string): MessageDto | undefined {
  for (const page of cache?.pages ?? []) {
    const hit = page.items.find((m) => m.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Flatten pages into one list, oldest first, for display. */
export function flattenOldestFirst(cache: CachedMessages | undefined): MessageDto[] {
  const all = (cache?.pages ?? []).flatMap((p) => p.items);
  const seen = new Set<string>();
  const unique: MessageDto[] = [];
  for (const m of all) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    unique.push(m);
  }
  return unique.reverse();
}

/** Update the row for one conversation in the cached list after a new message. */
export function bumpConversation(
  list: ConversationDto[] | undefined,
  message: MessageDto,
  viewerId: string,
  options: { open: boolean },
): ConversationDto[] | undefined {
  if (!list) return list;
  const at = list.findIndex((c) => c.id === message.conversationId);
  if (at === -1) return undefined; // Unknown conversation: let the caller refetch.
  const row = list[at]!;
  const incoming = message.senderId !== viewerId && !options.open;
  const updated: ConversationDto = {
    ...row,
    lastMessage: message,
    lastMessageAt: message.createdAt,
    unread: row.unread + (incoming ? 1 : 0),
  };
  return [updated, ...list.filter((_, i) => i !== at)];
}
