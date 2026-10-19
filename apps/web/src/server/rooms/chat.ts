import { getDb, toPublicUser, type User } from "@gistroom/db";
import {
  LIMITS,
  canDo,
  errors,
  type RoomChatDto,
  type RoomRole,
  isReactionEmoji,
} from "@gistroom/shared";
import { decodeCursor, encodeCursor } from "../cursor";
import { AppError, forbidden, notFound } from "../http";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { actorRole, loadBySlug, log, memberOf, roleIn } from "./core";

// ---------- Room chat ----------

const chatDto = (
  row: {
    id: string;
    clientId: string;
    body: string;
    createdAt: Date;
    editedAt: Date | null;
    deletedAt: Date | null;
    deletedById: string | null;
  },
  sender: User,
  senderRole: RoomRole,
  viewerId: string,
  reactions: RoomChatDto["reactions"] = [],
): RoomChatDto => ({
  id: row.id,
  clientId: row.clientId,
  sender: toPublicUser(sender),
  senderRole,
  body: row.deletedAt ? "" : row.body,
  createdAt: row.createdAt.toISOString(),
  editedAt: row.editedAt?.toISOString() ?? null,
  deleted: row.deletedAt ? (row.deletedById === viewerId ? "BY_ME" : "BY_OTHER") : null,
  reactions: row.deletedAt ? [] : reactions,
});

export async function postRoomMessage(
  me: User,
  slug: string,
  input: { clientId: string; body: string },
): Promise<RoomChatDto> {
  await enforce(policies.roomChat, me.id);
  const db = getDb();
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (room.status !== "LIVE" || member?.state !== "JOINED") throw forbidden(errors.roomNotAllowed);
  const role = await roleIn(room, me.id);
  const existing = await db.roomMessage.findUnique({
    where: { senderId_clientId: { senderId: me.id, clientId: input.clientId } },
  });
  if (existing) return chatDto(existing, me, role, me.id);
  const privileged = canDo(role, "DELETE_MESSAGE");
  if (room.chatMode === "OFF" || (room.chatMode === "MODERATORS" && !privileged)) {
    throw forbidden(errors.roomChatClosed);
  }
  if (room.slowModeSec > 0 && !privileged) {
    const last = await db.roomMessage.findFirst({
      where: { roomId: room.id, senderId: me.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const waitMs = last ? last.createdAt.getTime() + room.slowModeSec * 1000 - Date.now() : 0;
    if (waitMs > 0) {
      throw new AppError(429, "RATE_LIMITED", errors.roomSlowMode(Math.ceil(waitMs / 1000)));
    }
  }
  const row = await db.roomMessage.create({
    data: { roomId: room.id, senderId: me.id, clientId: input.clientId, body: input.body },
  });
  await db.room.update({ where: { id: room.id }, data: { messageCount: { increment: 1 } } });
  void publish({ type: "room", roomId: room.id, change: "chat", messageId: row.id });
  return chatDto(row, me, role, me.id);
}

interface ChatCursor {
  t: string;
  id: string;
}

const isChatCursor = (v: unknown): v is ChatCursor =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as ChatCursor).t === "string" &&
  typeof (v as ChatCursor).id === "string";

/** Newest first, in pages. Only people in the room can read it. */
export async function listRoomMessages(
  me: User,
  slug: string,
  cursor: string | null,
  limit = 50,
): Promise<{ items: RoomChatDto[]; nextCursor: string | null }> {
  const db = getDb();
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (!member || (member.state !== "JOINED" && member.state !== "LEFT")) throw notFound();
  if (room.status === "ENDED") return { items: [], nextCursor: null };
  const after = decodeCursor(cursor, isChatCursor);
  // Someone who comes in late does not see what was said before they arrived.
  const since = member.joinedAt ?? new Date(0);
  const rows = await db.roomMessage.findMany({
    where: {
      roomId: room.id,
      createdAt: { gte: since },
      ...(after
        ? {
            OR: [
              { createdAt: { lt: new Date(after.t) } },
              { createdAt: new Date(after.t), id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const senders = page.length
    ? await db.user.findMany({ where: { id: { in: [...new Set(page.map((r) => r.senderId))] } } })
    : [];
  const byId = new Map(senders.map((u) => [u.id, u]));
  const roles = new Map(
    (
      await db.roomMember.findMany({
        where: { roomId: room.id, userId: { in: [...byId.keys()] } },
        select: { userId: true, role: true },
      })
    ).map((m) => [m.userId, m.role]),
  );
  const reactionRows = page.length
    ? await db.roomReaction.findMany({ where: { messageId: { in: page.map((r) => r.id) } } })
    : [];
  const items = page.flatMap((r) => {
    const s = byId.get(r.senderId);
    if (!s) return [];
    const role: RoomRole = room.hostId === s.id ? "HOST" : (roles.get(s.id) ?? "MEMBER");
    const mine = reactionRows.filter((x) => x.messageId === r.id);
    const grouped = new Map<string, { count: number; mine: boolean }>();
    for (const x of mine) {
      const g = grouped.get(x.emoji) ?? { count: 0, mine: false };
      g.count += 1;
      if (x.userId === me.id) g.mine = true;
      grouped.set(x.emoji, g);
    }
    return [
      chatDto(
        r,
        s,
        role,
        me.id,
        [...grouped].map(([emoji, g]) => ({ emoji, ...g })),
      ),
    ];
  });
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id })
        : null,
  };
}

/** Moderators delete any message. Everyone else deletes their own. */
export async function deleteRoomMessage(me: User, slug: string, messageId: string): Promise<void> {
  const db = getDb();
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!role) throw forbidden(errors.roomNotAllowed);
  const row = await db.roomMessage.findFirst({ where: { id: messageId, roomId: room.id } });
  if (!row) return;
  const own = row.senderId === me.id;
  if (!own && !canDo(role, "DELETE_MESSAGE")) throw forbidden(errors.roomNotAllowed);
  if (row.deletedAt) return;
  // The row stays as a marker, so the person who deleted it reads "You deleted a message" and others see it was removed.
  await db.roomMessage.update({
    where: { id: row.id },
    data: { deletedAt: new Date(), deletedById: me.id, body: "" },
  });
  await db.roomReaction.deleteMany({ where: { messageId: row.id } });
  if (!own) await log(room.id, me.id, "MESSAGE_DELETED", row.senderId, { messageId });
  void publish({ type: "room", roomId: room.id, change: "chat-deleted", messageId });
}

/** The sender edits their own message for a short while. Everyone sees Edited next to it. */
export async function editRoomMessage(
  me: User,
  slug: string,
  messageId: string,
  body: string,
): Promise<void> {
  await enforce(policies.roomChat, me.id);
  const db = getDb();
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (room.status !== "LIVE" || member?.state !== "JOINED") throw forbidden(errors.roomNotAllowed);
  const row = await db.roomMessage.findFirst({ where: { id: messageId, roomId: room.id } });
  if (!row) throw notFound();
  const fresh = Date.now() - row.createdAt.getTime() <= LIMITS.EDIT_WINDOW_MIN * 60_000;
  if (row.senderId !== me.id || row.deletedAt || !fresh) {
    throw forbidden(errors.roomNotAllowed);
  }
  await db.roomMessage.update({ where: { id: row.id }, data: { body, editedAt: new Date() } });
  void publish({ type: "room", roomId: room.id, change: "chat-deleted", messageId });
}

/** Toggle one reaction on a chat message. Everyone in the room sees the counts change. */
export async function reactToRoomMessage(
  me: User,
  slug: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  await enforce(policies.roomReaction, me.id);
  if (!isReactionEmoji(emoji)) throw new AppError(400, "INVALID", errors.roomNotAllowed);
  const db = getDb();
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (member?.state !== "JOINED" || !room.reactionsOn) throw forbidden(errors.roomNotAllowed);
  const row = await db.roomMessage.findFirst({ where: { id: messageId, roomId: room.id } });
  if (!row) throw notFound();
  const key = { messageId_userId_emoji: { messageId, userId: me.id, emoji } };
  const had = await db.roomReaction.findUnique({ where: key });
  if (had) await db.roomReaction.delete({ where: key });
  else {
    await db.roomReaction.create({ data: { roomId: room.id, messageId, userId: me.id, emoji } });
    await db.room.update({ where: { id: room.id }, data: { reactionCount: { increment: 1 } } });
  }
  void publish({ type: "room", roomId: room.id, change: "chat-updated", messageId });
}

/** Chat of rooms that ended before chat was deleted on end. Run by the daily sweep, then it finds nothing. */
export async function purgeEndedRoomChat(): Promise<number> {
  const done = await getDb().roomMessage.deleteMany({ where: { room: { status: "ENDED" } } });
  return done.count;
}
