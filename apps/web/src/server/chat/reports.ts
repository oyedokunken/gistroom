import { getDb, type User } from "@gistroom/db";
import type { Prisma } from "@gistroom/db";
import type { ReportInput } from "@gistroom/shared";
import { notFound } from "../http";
import { enforce, policies } from "../rate-limit";
import { sendTemplate } from "../mail/send";
import { accessFor } from "./service";

/** How many recent messages are kept as evidence when a chat or message is reported (Section 9.3). */
export const EVIDENCE_COUNT = 20;

/**
 * Report a chat, or one message in it. Works even when the reporter has blocked the other person, because
 * blocking someone should never stop you reporting them. The last 20 messages are saved as evidence.
 */
export async function reportChat(
  me: User,
  conversationId: string,
  input: ReportInput,
): Promise<{ id: string }> {
  await enforce(policies.reports, me.id);
  const access = await accessFor(me.id, conversationId);
  const db = getDb();

  let targetType: "USER" | "MESSAGE" = "USER";
  let targetId = access.peerId;
  if (input.messageId) {
    const msg = await db.message.findFirst({
      where: { id: input.messageId, conversationId },
      select: { id: true },
    });
    if (!msg) throw notFound();
    targetType = "MESSAGE";
    targetId = msg.id;
  }

  const recent = await db.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: EVIDENCE_COUNT,
    select: {
      id: true,
      senderId: true,
      type: true,
      body: true,
      createdAt: true,
      deletedForEveryoneAt: true,
    },
  });
  const evidence = {
    conversationId,
    reportedUserId: access.peerId,
    messages: recent.reverse().map((m) => ({
      id: m.id,
      senderId: m.senderId,
      type: m.type,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      deletedForEveryone: m.deletedForEveryoneAt !== null,
    })),
  } satisfies Prisma.InputJsonValue;

  const report = await db.report.create({
    data: {
      reporterId: me.id,
      targetType,
      targetId,
      reason: input.reason,
      details: input.details?.trim() || null,
      evidence,
    },
  });
  try {
    await sendTemplate("report-received", me.email, {});
  } catch {
    // The report is saved. A failed confirmation email does not undo it.
  }
  return { id: report.id };
}
