import { getDb } from "@gistroom/db";

/**
 * Cutoff for "unread": messages from the other person created after the later of
 * the last read message and the moment the chat was cleared for me.
 */
export function unreadCutoff(lastReadAt: Date | null, clearedAt: Date | null): Date | null {
  if (lastReadAt && clearedAt) return lastReadAt > clearedAt ? lastReadAt : clearedAt;
  return lastReadAt ?? clearedAt;
}

/** Unread message count per conversation id, for one person. Archived chats are included. */
export async function unreadByConversation(userId: string): Promise<Map<string, number>> {
  const db = getDb();
  const members = await db.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true, lastReadMessageId: true, clearedAt: true },
  });
  if (members.length === 0) return new Map();

  const readIds = members.map((m) => m.lastReadMessageId).filter((id): id is string => id !== null);
  const reads = readIds.length
    ? await db.message.findMany({
        where: { id: { in: readIds } },
        select: { id: true, createdAt: true },
      })
    : [];
  const readAt = new Map(reads.map((r) => [r.id, r.createdAt]));

  const groups = await db.message.groupBy({
    by: ["conversationId"],
    where: {
      OR: members.map((m) => {
        const cutoff = unreadCutoff(
          m.lastReadMessageId ? (readAt.get(m.lastReadMessageId) ?? null) : null,
          m.clearedAt,
        );
        return {
          conversationId: m.conversationId,
          senderId: { not: userId },
          deletedForEveryoneAt: null,
          hiddenBy: { none: { userId } },
          ...(cutoff ? { createdAt: { gt: cutoff } } : {}),
        };
      }),
    },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.conversationId, g._count._all]));
}

export async function unreadChatCount(userId: string): Promise<number> {
  const map = await unreadByConversation(userId);
  let n = 0;
  for (const c of map.values()) n += c;
  return n;
}
