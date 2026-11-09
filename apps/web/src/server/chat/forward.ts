import { randomUUID } from "node:crypto";
import { getDb, type Prisma, type User } from "@gistroom/db";
import {
  FORWARDABLE_TYPES,
  errors,
  extensionOf,
  type ForwardInput,
  type ForwardOutcome,
  type ForwardResult,
  type MessageType,
} from "@gistroom/shared";
import { AppError } from "../http";
import { ensureConversation } from "../friends/service";
import { enforce, policies } from "../rate-limit";
import { assertMediaBucketPrivate, buckets, copyObject, removeObjects } from "../storage";
import { accessFor, assertCanInteract, sendMessage } from "./service";

type Source = Prisma.MessageGetPayload<{ include: { attachments: true } }>;

/** The rules for what may be forwarded, kept pure so they are tested without a database. */
export function forwardable(input: {
  type: string;
  deletedForEveryoneAt: Date | null;
  hiddenForMe: boolean;
  createdAt: Date;
  clearedAt: Date | null;
}): boolean {
  if (input.deletedForEveryoneAt || input.hiddenForMe) return false;
  if (input.clearedAt && input.createdAt <= input.clearedAt) return false;
  return (FORWARDABLE_TYPES as readonly string[]).includes(input.type);
}

/** The client id of one copy. The same batch, person and message always give the same id, so a retry finds the first copy. */
export const forwardClientId = (batchId: string, destination: number, message: number): string =>
  `fwd_${batchId}_${destination}_${message}`;

/** Load what the person may forward, in the order the messages were sent. Anything else is counted and left out. */
async function loadSources(
  me: User,
  messageIds: string[],
): Promise<{ sources: Source[]; skipped: number }> {
  const db = getDb();
  const rows = await db.message.findMany({
    where: { id: { in: messageIds } },
    include: { attachments: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const hidden = new Set(
    (
      await db.messageHidden.findMany({
        where: { userId: me.id, messageId: { in: messageIds } },
        select: { messageId: true },
      })
    ).map((h) => h.messageId),
  );
  const access = new Map<string, Awaited<ReturnType<typeof accessFor>> | null>();
  const sources: Source[] = [];
  for (const row of rows) {
    if (!access.has(row.conversationId)) {
      // A chat the person is not in answers exactly like a message that does not exist.
      access.set(row.conversationId, await accessFor(me.id, row.conversationId).catch(() => null));
    }
    const mine = access.get(row.conversationId);
    if (!mine) continue;
    if (
      forwardable({
        type: row.type,
        deletedForEveryoneAt: row.deletedForEveryoneAt,
        hiddenForMe: hidden.has(row.id),
        createdAt: row.createdAt,
        clearedAt: mine.clearedAt,
      })
    ) {
      sources.push(row);
    }
  }
  return { sources, skipped: messageIds.length - sources.length };
}

/** A file copied into the destination chat under a path of its own, so the copy outlives the original. */
async function copyAttachment(me: User, destinationConversationId: string, source: Source) {
  const att = source.attachments[0];
  if (!att) return null;
  const bucket = buckets.media();
  const folder = `dm/${destinationConversationId}/${me.id}`;
  const path = `${folder}/${randomUUID()}.${extensionOf(att.storagePath) || "bin"}`;
  if (!(await copyObject(bucket, att.storagePath, path))) return null;
  let thumbPath: string | null = null;
  if (att.thumbPath) {
    const t = `${folder}/${randomUUID()}.jpg`;
    if (await copyObject(bucket, att.thumbPath, t)) thumbPath = t;
  }
  await getDb().fileAsset.createMany({
    data: [
      {
        ownerId: me.id,
        bucket,
        path,
        mime: att.mime,
        sizeBytes: att.sizeBytes,
        status: "ATTACHED" as const,
      },
      ...(thumbPath
        ? [
            {
              ownerId: me.id,
              bucket,
              path: thumbPath,
              mime: "image/jpeg",
              sizeBytes: 0,
              status: "ATTACHED" as const,
            },
          ]
        : []),
    ],
  });
  return { path, thumbPath, att };
}

/**
 * Forward messages to friends. Each copy is a new message with a new client id, sent by the forwarder at the time of
 * the forward. It says only "Forwarded": the original sender and time are never carried over, and a forward of a forward
 * reads the same. Files are copied to a path in the destination chat, so media authorization stays with that chat.
 */
export async function forwardMessages(me: User, input: ForwardInput): Promise<ForwardResult> {
  await enforce(policies.forward, me.id);
  const { sources, skipped } = await loadSources(me, input.messageIds);
  if (sources.length === 0) throw new AppError(400, "INVALID", errors.forwardNothing);
  if (sources.some((s) => s.attachments.length > 0)) await assertMediaBucketPrivate();

  const db = getDb();
  const outcomes: ForwardOutcome[] = [];
  for (const [d, userId] of input.userIds.entries()) {
    const outcome: ForwardOutcome = { userId, conversationId: null, sent: 0, error: null };
    outcomes.push(outcome);
    try {
      // Same rule as any send: friends only, no block in either direction.
      await assertCanInteract(me.id, userId);
      const conversationId = await ensureConversation(me.id, userId);
      outcome.conversationId = conversationId;
      for (const [i, source] of sources.entries()) {
        const clientId = forwardClientId(input.batchId, d, i);
        const already = await db.message.findUnique({
          where: { senderId_clientId: { senderId: me.id, clientId } },
          select: { id: true },
        });
        if (already) {
          outcome.sent += 1;
          continue;
        }
        const type = source.type as MessageType;
        const baseMeta: Record<string, unknown> = { forwarded: true, forwardedFrom: type };
        const original = (source.meta as { fileName?: unknown } | null)?.fileName;
        if (typeof original === "string") baseMeta["fileName"] = original;

        if (source.attachments.length === 0) {
          await sendMessage(me, conversationId, {
            clientId,
            type,
            body: source.body,
            meta: baseMeta,
          });
        } else {
          const copied = await copyAttachment(me, conversationId, source);
          if (!copied) continue;
          try {
            await sendMessage(me, conversationId, {
              clientId,
              type,
              body: source.body,
              meta: baseMeta,
              attachment: {
                storagePath: copied.path,
                thumbPath: copied.thumbPath,
                mime: copied.att.mime,
                sizeBytes: copied.att.sizeBytes,
                width: copied.att.width,
                height: copied.att.height,
                durationMs: copied.att.durationMs,
                waveform: copied.att.waveform,
              },
            });
          } catch (error) {
            // Nothing points at the copy, so it must not stay behind.
            await removeObjects(
              buckets.media(),
              [copied.path, copied.thumbPath].filter((p): p is string => Boolean(p)),
            );
            throw error;
          }
        }
        outcome.sent += 1;
      }
      if (outcome.sent === 0) outcome.error = errors.forwardFailed;
    } catch (error) {
      outcome.error = error instanceof AppError ? error.message : errors.forwardFailed;
    }
  }
  return { outcomes, skipped };
}
