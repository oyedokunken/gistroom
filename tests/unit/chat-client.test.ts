import { describe, expect, it } from "vitest";
import type { ConversationDto, MessageDto } from "../../packages/shared/src";
import {
  advancePeerCursor,
  bumpConversation,
  findMessage,
  flattenOldestFirst,
  upsertMessage,
  type CachedMessages,
} from "../../apps/web/src/lib/chat/cache";
import {
  enqueue,
  isRetryable,
  markStatus,
  nextToSend,
  recoverAfterReload,
  remove,
  retryFailed,
  type OutboxItem,
} from "../../apps/web/src/lib/chat/outbox";

const msg = (id: string, at: string, over: Partial<MessageDto> = {}): MessageDto => ({
  id,
  conversationId: "c1",
  senderId: "a",
  clientId: `cid-${id}`,
  type: "TEXT",
  body: id,
  replyToId: null,
  replyPreview: null,
  meta: null,
  createdAt: at,
  deletedForEveryone: false,
  attachments: [],
  reactions: [],
  starred: false,
  ...over,
});

const cache = (...items: MessageDto[]): CachedMessages => ({
  pages: [
    {
      items,
      nextCursor: null,
      peer: { id: "b", deliveredAt: null, readAt: null, sendsReadReceipts: true },
    },
  ],
  pageParams: [null],
});

describe("message cache", () => {
  it("adds a new message at the newest end", () => {
    const next = upsertMessage(
      cache(msg("m1", "2026-10-10T10:00:00Z")),
      msg("m2", "2026-10-10T10:01:00Z"),
    );
    expect(next?.pages[0]?.items.map((m) => m.id)).toEqual(["m2", "m1"]);
  });
  it("replaces the optimistic copy by clientId instead of duplicating", () => {
    const optimistic = msg("local-1", "2026-10-10T10:00:00Z", { clientId: "k1" });
    const server = msg("srv-1", "2026-10-10T10:00:01Z", { clientId: "k1" });
    const next = upsertMessage(cache(optimistic), server);
    expect(next?.pages[0]?.items).toHaveLength(1);
    expect(next?.pages[0]?.items[0]?.id).toBe("srv-1");
  });
  it("is idempotent for a repeated event and keeps order for a late one", () => {
    const base = cache(msg("m3", "2026-10-10T10:03:00Z"), msg("m1", "2026-10-10T10:01:00Z"));
    const once = upsertMessage(base, msg("m2", "2026-10-10T10:02:00Z"));
    const twice = upsertMessage(once, msg("m2", "2026-10-10T10:02:00Z"));
    expect(twice?.pages[0]?.items.map((m) => m.id)).toEqual(["m3", "m2", "m1"]);
  });
  it("leaves an unloaded conversation alone", () => {
    expect(upsertMessage(undefined, msg("m1", "2026-10-10T10:00:00Z"))).toBeUndefined();
  });
  it("flattens oldest first without duplicates", () => {
    const c = cache(msg("m2", "2026-10-10T10:02:00Z"), msg("m1", "2026-10-10T10:01:00Z"));
    c.pages.push({
      ...c.pages[0]!,
      items: [msg("m1", "2026-10-10T10:01:00Z"), msg("m0", "2026-10-10T10:00:00Z")],
    });
    expect(flattenOldestFirst(c).map((m) => m.id)).toEqual(["m0", "m1", "m2"]);
    expect(findMessage(c, "m0")?.id).toBe("m0");
  });
});

describe("peer cursors", () => {
  it("moves forward only", () => {
    const c = cache(msg("m1", "2026-10-10T10:00:00Z"));
    const d1 = advancePeerCursor(c, "delivered", "2026-10-10T10:05:00Z");
    expect(d1?.pages[0]?.peer.deliveredAt).toBe("2026-10-10T10:05:00Z");
    const d2 = advancePeerCursor(d1, "delivered", "2026-10-10T10:01:00Z");
    expect(d2?.pages[0]?.peer.deliveredAt).toBe("2026-10-10T10:05:00Z");
    expect(advancePeerCursor(d2, "read", "2026-10-10T10:06:00Z")?.pages[0]?.peer.readAt).toBe(
      "2026-10-10T10:06:00Z",
    );
  });
});

describe("conversation list bump", () => {
  const row = (id: string, at: string, unread = 0): ConversationDto => ({
    id,
    peer: { id: `p-${id}`, name: id, username: id, avatarUrl: null, bio: null },
    lastMessage: null,
    lastMessageAt: at,
    unread,
    archived: false,
    muted: false,
  });
  it("moves the chat to the top and counts unread when it is not open", () => {
    const list = [row("c0", "2026-10-10T09:00:00Z"), row("c1", "2026-10-10T08:00:00Z", 1)];
    const next = bumpConversation(
      list,
      msg("m9", "2026-10-10T10:00:00Z", { senderId: "other" }),
      "me",
      { open: false },
    );
    expect(next?.[0]?.id).toBe("c1");
    expect(next?.[0]?.unread).toBe(2);
  });
  it("does not add unread for my own messages or an open chat", () => {
    const list = [row("c1", "2026-10-10T08:00:00Z", 0)];
    expect(
      bumpConversation(list, msg("m9", "2026-10-10T10:00:00Z", { senderId: "me" }), "me", {
        open: false,
      })?.[0]?.unread,
    ).toBe(0);
    expect(
      bumpConversation(list, msg("m9", "2026-10-10T10:00:00Z", { senderId: "other" }), "me", {
        open: true,
      })?.[0]?.unread,
    ).toBe(0);
  });
  it("asks for a refetch when the chat is not in the list yet", () => {
    expect(
      bumpConversation([], msg("m1", "2026-10-10T10:00:00Z"), "me", { open: false }),
    ).toBeUndefined();
  });
});

describe("outbox", () => {
  const item = (clientId: string, conversationId: string, at: string) => ({
    clientId,
    conversationId,
    body: clientId,
    replyToId: null,
    createdAt: at,
  });

  it("keeps the first copy when the same clientId is enqueued twice", () => {
    const q = enqueue(
      enqueue([], item("a", "c1", "2026-10-10T10:00:00Z")),
      item("a", "c1", "2026-10-10T10:00:05Z"),
    );
    expect(q).toHaveLength(1);
  });
  it("sends the oldest first within a chat and chats independently", () => {
    let q: OutboxItem[] = [];
    q = enqueue(q, item("b", "c1", "2026-10-10T10:00:02Z"));
    q = enqueue(q, item("a", "c1", "2026-10-10T10:00:01Z"));
    q = enqueue(q, item("x", "c2", "2026-10-10T10:00:03Z"));
    expect(nextToSend(q, new Set())?.clientId).toBe("a");
    q = markStatus(q, "a", "sending");
    // c1 is busy, so the next is c2, and b waits behind a.
    expect(nextToSend(q, new Set())?.clientId).toBe("x");
  });
  it("holds back newer messages behind a failed one so order is kept", () => {
    let q: OutboxItem[] = [];
    q = enqueue(q, item("a", "c1", "2026-10-10T10:00:01Z"));
    q = enqueue(q, item("b", "c1", "2026-10-10T10:00:02Z"));
    q = markStatus(q, "a", "failed");
    expect(nextToSend(q, new Set())).toBeNull();
    q = retryFailed(q);
    expect(nextToSend(q, new Set())?.clientId).toBe("a");
  });
  it("counts attempts, removes on success and recovers items stuck sending after a reload", () => {
    let q = enqueue([], item("a", "c1", "2026-10-10T10:00:01Z"));
    q = markStatus(q, "a", "sending");
    expect(q[0]?.attempts).toBe(1);
    expect(recoverAfterReload(q)[0]?.status).toBe("queued");
    expect(remove(q, "a")).toHaveLength(0);
  });
  it("only retries network and server errors", () => {
    expect([0, 408, 429, 500, 503].every(isRetryable)).toBe(true);
    expect([400, 403, 404, 409].some(isRetryable)).toBe(false);
  });
});
