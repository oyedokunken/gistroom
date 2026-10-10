import { advanceCursor } from "@gistroom/shared";
import { getDb } from "./index";

export interface ReceiptResult {
  moved: boolean;
  /** The newest message the cursor now points at. */
  messageId: string;
}

/**
 * Move a person's delivered or read cursor forward in one conversation. Used by the realtime service and the REST
 * fallback so both behave the same. Cursors never move backwards. A read also counts as delivered.
 */
export async function advanceReceipt(input: {
  userId: string;
  conversationId: string;
  messageId: string;
  kind: "delivered" | "read";
}): Promise<ReceiptResult | null> {
  const db = getDb();
  const member = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId: input.conversationId, userId: input.userId },
    },
  });
  if (!member) return null;
  const target = await db.message.findFirst({
    where: { id: input.messageId, conversationId: input.conversationId },
    select: { id: true, createdAt: true },
  });
  if (!target) return null;

  const [read, delivered] = await Promise.all([
    member.lastReadMessageId
      ? db.message.findUnique({
          where: { id: member.lastReadMessageId },
          select: { createdAt: true },
        })
      : null,
    member.lastDeliveredMessageId
      ? db.message.findUnique({
          where: { id: member.lastDeliveredMessageId },
          select: { createdAt: true },
        })
      : null,
  ]);

  const data: { lastReadMessageId?: string; lastDeliveredMessageId?: string } = {};
  if (input.kind === "read" && advanceCursor(read?.createdAt ?? null, target.createdAt)) {
    data.lastReadMessageId = target.id;
  }
  if (advanceCursor(delivered?.createdAt ?? null, target.createdAt)) {
    data.lastDeliveredMessageId = target.id;
  }
  if (Object.keys(data).length === 0) return { moved: false, messageId: target.id };
  await db.conversationMember.update({ where: { id: member.id }, data });
  return { moved: true, messageId: target.id };
}
