import type { Call, Prisma, User } from "./generated/client";
import { defaultAvatarSrc } from "@gistroom/shared";
import type { AttachmentDto, CallDto, MessageDto, PublicUser, ReactionDto } from "@gistroom/shared";

/** Public avatar URL from the public bucket. Null when none is set or storage is not configured. */
export function avatarUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!path || !base) return null;
  const bucket = process.env.SUPABASE_PUBLIC_BUCKET ?? "avatars";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

type PublicFields = Pick<User, "id" | "name" | "username" | "avatarPath" | "bio" | "status">;

/** Only name, username, avatar and bio ever leave the server about another person (Section 20). */
export function toPublicUser(user: PublicFields): PublicUser {
  if (user.status === "DELETED") {
    return { id: user.id, name: "Deleted user", username: "deleted", avatarUrl: null, bio: null };
  }
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: avatarUrl(user.avatarPath) ?? defaultAvatarSrc(user.id),
    bio: user.bio,
  };
}

/** Include clause that gives messageDto everything it needs for one viewer. */
export function messageInclude(viewerId: string) {
  return {
    attachments: true,
    reactions: true,
    stars: { where: { userId: viewerId }, select: { id: true } },
    replyTo: {
      select: { id: true, senderId: true, body: true, type: true, deletedForEveryoneAt: true },
    },
  } satisfies Prisma.MessageInclude;
}

export type MessageRow = Prisma.MessageGetPayload<{ include: ReturnType<typeof messageInclude> }>;

function reactionsFor(rows: MessageRow["reactions"], viewerId: string): ReactionDto[] {
  const byEmoji = new Map<string, ReactionDto>();
  for (const r of rows) {
    const entry = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    entry.count += 1;
    if (r.userId === viewerId) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }
  return [...byEmoji.values()];
}

/** Message as one viewer sees it. A message deleted for everyone loses its body and attachments. */
export function messageDto(row: MessageRow, viewerId: string): MessageDto {
  const deleted = row.deletedForEveryoneAt !== null;
  const attachments: AttachmentDto[] = deleted
    ? []
    : row.attachments.map((a) => ({
        id: a.id,
        mime: a.mime,
        sizeBytes: a.sizeBytes,
        width: a.width,
        height: a.height,
        durationMs: a.durationMs,
        waveform: a.waveform,
        hasThumb: a.thumbPath !== null,
      }));
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    clientId: row.clientId,
    type: row.type,
    body: deleted ? null : row.body,
    replyToId: row.replyToId,
    replyPreview: row.replyTo
      ? {
          id: row.replyTo.id,
          senderId: row.replyTo.senderId,
          body: row.replyTo.deletedForEveryoneAt ? null : row.replyTo.body,
          type: row.replyTo.type,
        }
      : null,
    meta: deleted ? null : ((row.meta as Record<string, unknown> | null) ?? null),
    createdAt: row.createdAt.toISOString(),
    deletedForEveryone: deleted,
    editedAt: deleted ? null : (row.editedAt?.toISOString() ?? null),
    attachments,
    reactions: deleted ? [] : reactionsFor(row.reactions, viewerId),
    starred: row.stars.length > 0,
  };
}

import { notificationHref, type NotificationDto, type NotificationType } from "@gistroom/shared";
import type { Notification } from "./generated/client";

export function toNotificationDto(n: Notification): NotificationDto {
  const payload = (n.payload as Record<string, unknown> | null) ?? {};
  const type = n.type as NotificationType;
  return {
    id: n.id,
    type,
    payload,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    href: notificationHref(type, payload),
  };
}

/** Key of the one DM between two people, lowest id first. */
export function dmKeyOf(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** A call as one of its two people sees it. The peer is always the other person. */
export function callDto(
  row: Call & { caller: User; callee: User },
  viewerId: string,
  conversationId: string | null,
): CallDto {
  const outgoing = row.callerId === viewerId;
  return {
    id: row.id,
    status: row.status,
    media: row.initialMedia,
    direction: outgoing ? "OUTGOING" : "INCOMING",
    peer: toPublicUser(outgoing ? row.callee : row.caller),
    conversationId,
    ringExpiresAt: row.ringExpiresAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    endReason: row.endReason,
    endedBy: row.endedAt
      ? row.endedById
        ? row.endedById === viewerId
          ? "ME"
          : "PEER"
        : "SYSTEM"
      : null,
    peerReachable: null,
  };
}
