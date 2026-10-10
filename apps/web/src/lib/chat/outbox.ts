export type OutboxStatus = "queued" | "sending" | "failed";

export interface OutboxItem {
  clientId: string;
  conversationId: string;
  body: string;
  replyToId: string | null;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
}

/**
 * Pure queue operations for outgoing messages (Section 9.3). The store in outbox-store.ts persists this to IndexedDB
 * and flushes it in order on reconnect. Sends are idempotent on clientId, so a retry can never create a duplicate.
 */
export function enqueue(
  queue: readonly OutboxItem[],
  item: Omit<OutboxItem, "status" | "attempts">,
): OutboxItem[] {
  if (queue.some((q) => q.clientId === item.clientId)) return [...queue];
  return [...queue, { ...item, status: "queued", attempts: 0 }];
}

/** The next item to send: the oldest per conversation, so one chat cannot send out of order. */
export function nextToSend(
  queue: readonly OutboxItem[],
  busyConversations: ReadonlySet<string>,
): OutboxItem | null {
  const sorted = [...queue].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const blocked = new Set(busyConversations);
  for (const item of sorted) {
    if (blocked.has(item.conversationId)) continue;
    if (item.status === "queued") return item;
    // A failed or in flight item holds back newer ones in the same chat.
    blocked.add(item.conversationId);
  }
  return null;
}

export function markStatus(
  queue: readonly OutboxItem[],
  clientId: string,
  status: OutboxStatus,
): OutboxItem[] {
  return queue.map((q) =>
    q.clientId === clientId
      ? { ...q, status, attempts: status === "sending" ? q.attempts + 1 : q.attempts }
      : q,
  );
}

export function remove(queue: readonly OutboxItem[], clientId: string): OutboxItem[] {
  return queue.filter((q) => q.clientId !== clientId);
}

/** Put failed items back in line, for the retry button and for coming back online. */
export function retryFailed(queue: readonly OutboxItem[], conversationId?: string): OutboxItem[] {
  return queue.map((q) =>
    q.status === "failed" && (!conversationId || q.conversationId === conversationId)
      ? { ...q, status: "queued" }
      : q,
  );
}

/** Items that were mid flight when the page closed go back to queued on the next load. */
export function recoverAfterReload(queue: readonly OutboxItem[]): OutboxItem[] {
  return queue.map((q) => (q.status === "sending" ? { ...q, status: "queued" } : q));
}

/** A client error such as a 400 will not get better by retrying. Network errors and 5xx will. */
export function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Collision resistant id for idempotency. crypto.randomUUID needs a secure context, which the app always has. */
export function newClientId(): string {
  return globalThis.crypto.randomUUID();
}
