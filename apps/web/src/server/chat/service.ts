import {
  advanceReceipt,
  getDb,
  messageDto,
  messageInclude,
  toPublicUser,
  type Prisma,
  type User,
} from "@gistroom/db";
import {
  LIMITS,
  errors,
  type ConversationDto,
  type MessageDto,
  type MessageType,
  type Page,
} from "@gistroom/shared";
import { decodeCursor, encodeCursor } from "../cursor";
import { AppError, forbidden, notFound } from "../http";
import { enforce, policies } from "../rate-limit";
import { isUniqueViolation } from "../db-errors";
import { areFriends, isBlockedEitherWay } from "../friends/relations";
import { notify } from "../notifications/service";
import { publish } from "../realtime";
import {
  bodyIsValid,
  canDeleteForEveryone,
  canEditMessage,
  chatAvailability,
  isSingleEmoji,
  previewText,
  showInList,
} from "./rules";
import { unreadByConversation } from "./unread";

export interface Access {
  conversationId: string;
  peerId: string;
  clearedAt: Date | null;
  archivedAt: Date | null;
}

/** Membership check used by every chat route. Strangers get a 404, not a 403, so ids leak nothing (R16). */
export async function accessFor(userId: string, conversationId: string): Promise<Access> {
  const members = await getDb().conversationMember.findMany({ where: { conversationId } });
  const mine = members.find((m) => m.userId === userId);
  const peer = members.find((m) => m.userId !== userId);
  if (!mine || !peer) throw notFound();
  return {
    conversationId,
    peerId: peer.userId,
    clearedAt: mine.clearedAt,
    archivedAt: mine.archivedAt,
  };
}

/** Sending needs an accepted friendship and no block either way (Section 9.2). */
export async function assertCanInteract(userId: string, peerId: string): Promise<void> {
  // A block is never named to the person who was blocked, so both sides get the same plain answer.
  if (await isBlockedEitherWay(userId, peerId)) throw forbidden(errors.chatUnavailable);
  if (!(await areFriends(userId, peerId))) throw forbidden(errors.notFriends);
}

/** How each peer looks to me: blocked by me, unavailable (they blocked me or are gone), or fine. */
async function availabilityFor(
  meId: string,
  peers: { id: string; status: string }[],
): Promise<Map<string, "OK" | "BLOCKED_BY_ME" | "UNAVAILABLE">> {
  const ids = peers.map((p) => p.id);
  const blocks = ids.length
    ? await getDb().block.findMany({
        where: {
          OR: [
            { blockerId: meId, blockedId: { in: ids } },
            { blockedId: meId, blockerId: { in: ids } },
          ],
        },
        select: { blockerId: true, blockedId: true },
      })
    : [];
  const out = new Map<string, "OK" | "BLOCKED_BY_ME" | "UNAVAILABLE">();
  for (const p of peers) {
    out.set(
      p.id,
      chatAvailability({
        blockedByMe: blocks.some((b) => b.blockerId === meId && b.blockedId === p.id),
        blockedMe: blocks.some((b) => b.blockerId === p.id && b.blockedId === meId),
        peerGone: p.status !== "ACTIVE",
      }),
    );
  }
  return out;
}

// ---------- Listing ----------

export async function listConversations(me: User, archived: boolean): Promise<ConversationDto[]> {
  const db = getDb();
  const memberships = await db.conversationMember.findMany({
    where: { userId: me.id, archivedAt: archived ? { not: null } : null },
    include: { conversation: { include: { members: true } } },
  });
  const visible = memberships.filter((m) =>
    showInList({ clearedAt: m.clearedAt, lastMessageAt: m.conversation.lastMessageAt }),
  );
  if (visible.length === 0) return [];

  const peerIds = visible.map(
    (m) => m.conversation.members.find((x) => x.userId !== me.id)?.userId ?? "",
  );
  const [peers, unread] = await Promise.all([
    db.user.findMany({ where: { id: { in: peerIds } } }),
    unreadByConversation(me.id),
  ]);
  const peerById = new Map(peers.map((p) => [p.id, p]));
  const availability = await availabilityFor(me.id, peers);

  const lastRows = await Promise.all(
    visible.map((m) =>
      db.message.findFirst({
        where: {
          conversationId: m.conversationId,
          hiddenBy: { none: { userId: me.id } },
          ...(m.clearedAt ? { createdAt: { gt: m.clearedAt } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: messageInclude(me.id),
      }),
    ),
  );

  const out: ConversationDto[] = [];
  visible.forEach((m, i) => {
    const peer = peerById.get(peerIds[i] ?? "");
    if (!peer) return;
    const last = lastRows[i];
    out.push({
      id: m.conversationId,
      peer: toPublicUser(peer),
      lastMessage: last ? messageDto(last, me.id) : null,
      lastMessageAt: (last?.createdAt ?? m.conversation.lastMessageAt)?.toISOString() ?? null,
      unread: unread.get(m.conversationId) ?? 0,
      archived: m.archivedAt !== null,
      muted: m.mutedUntil !== null && m.mutedUntil > new Date(),
      availability: availability.get(peer.id) ?? "OK",
    });
  });
  return out.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
}

/** For the Archived row dot: is there unread activity in archived chats? */
export async function archivedUnreadCount(me: User): Promise<number> {
  const rows = await getDb().conversationMember.findMany({
    where: { userId: me.id, archivedAt: { not: null } },
    select: { conversationId: true },
  });
  if (rows.length === 0) return 0;
  const unread = await unreadByConversation(me.id);
  return rows.reduce((n, r) => n + (unread.get(r.conversationId) ?? 0), 0);
}

export interface MessagesPage extends Page<MessageDto> {
  peer: {
    id: string;
    deliveredAt: string | null;
    readAt: string | null;
    sendsReadReceipts: boolean;
  };
}

interface MsgCursor {
  t: string;
  id: string;
}
const isMsgCursor = (v: unknown): v is MsgCursor =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as MsgCursor).t === "string" &&
  typeof (v as MsgCursor).id === "string";

/** Newest first, in pages. The client reverses for display and prepends older pages as you scroll up. */
export async function getMessages(
  me: User,
  conversationId: string,
  cursor: string | null,
  limit: number,
): Promise<MessagesPage> {
  const db = getDb();
  const access = await accessFor(me.id, conversationId);
  const after = decodeCursor(cursor, isMsgCursor);
  const afterDate = after ? new Date(after.t) : null;
  const rows = await db.message.findMany({
    where: {
      conversationId,
      hiddenBy: { none: { userId: me.id } },
      ...(access.clearedAt ? { createdAt: { gt: access.clearedAt } } : {}),
      ...(after && afterDate
        ? { OR: [{ createdAt: { lt: afterDate } }, { createdAt: afterDate, id: { lt: after.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: messageInclude(me.id),
  });
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];

  const [peerMember, peerUser] = await Promise.all([
    db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: access.peerId } },
    }),
    db.user.findUnique({ where: { id: access.peerId }, select: { sendReadReceipts: true } }),
  ]);
  const cursorIds = [peerMember?.lastDeliveredMessageId, peerMember?.lastReadMessageId].filter(
    (x): x is string => Boolean(x),
  );
  const cursorMsgs = cursorIds.length
    ? await db.message.findMany({
        where: { id: { in: cursorIds } },
        select: { id: true, createdAt: true },
      })
    : [];
  const at = (id: string | null | undefined) =>
    cursorMsgs.find((m) => m.id === id)?.createdAt.toISOString() ?? null;

  return {
    items: items.map((r) => messageDto(r, me.id)),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id })
        : null,
    peer: {
      id: access.peerId,
      deliveredAt: at(peerMember?.lastDeliveredMessageId),
      readAt: at(peerMember?.lastReadMessageId),
      sendsReadReceipts: peerUser?.sendReadReceipts ?? true,
    },
  };
}

// ---------- Sending ----------

export interface SendInput {
  clientId: string;
  type: MessageType;
  body: string | null;
  replyToId?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Create a message. Idempotent on (sender, clientId): a retry returns the original and sends nothing twice (R17).
 * Returns the message plus whether it was newly created.
 */
export async function sendMessage(
  me: User,
  conversationId: string,
  input: SendInput,
): Promise<{ message: MessageDto; created: boolean }> {
  const db = getDb();
  const access = await accessFor(me.id, conversationId);
  await assertCanInteract(me.id, access.peerId);
  if (!bodyIsValid(input.type, input.body)) {
    throw new AppError(400, "INVALID", errors.messageTooLong(LIMITS.MESSAGE_MAX_CHARS), {
      fields: { body: errors.messageTooLong(LIMITS.MESSAGE_MAX_CHARS) },
    });
  }

  const existing = await db.message.findUnique({
    where: { senderId_clientId: { senderId: me.id, clientId: input.clientId } },
    include: messageInclude(me.id),
  });
  if (existing) {
    if (existing.conversationId !== conversationId) throw notFound();
    return { message: messageDto(existing, me.id), created: false };
  }
  await enforce(policies.messages, me.id);

  if (input.replyToId) {
    const target = await db.message.findFirst({
      where: { id: input.replyToId, conversationId },
      select: { id: true },
    });
    if (!target) throw notFound();
  }

  let row;
  try {
    row = await db.message.create({
      data: {
        conversationId,
        senderId: me.id,
        clientId: input.clientId,
        type: input.type,
        body: input.body?.trim() || null,
        replyToId: input.replyToId ?? null,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: messageInclude(me.id),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const winner = await db.message.findUnique({
        where: { senderId_clientId: { senderId: me.id, clientId: input.clientId } },
        include: messageInclude(me.id),
      });
      if (winner) return { message: messageDto(winner, me.id), created: false };
    }
    throw error;
  }

  await Promise.all([
    db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: row.createdAt },
    }),
    // My own message counts as read by me.
    db.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: me.id } },
      data: { lastReadMessageId: row.id, lastDeliveredMessageId: row.id },
    }),
  ]);

  await notifyRecipient(me, access.peerId, conversationId, row.type, row.body);
  void publish({ type: "message:new", messageId: row.id });
  return { message: messageDto(row, me.id), created: true };
}

/** One notification row per conversation: it counts up while unread (Section 10.6). */
async function notifyRecipient(
  me: User,
  peerId: string,
  conversationId: string,
  type: string,
  body: string | null,
) {
  const peerMember = await getDb().conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: peerId } },
    select: { mutedUntil: true },
  });
  if (peerMember?.mutedUntil && peerMember.mutedUntil > new Date()) return;
  const preview = previewText({ type, body, deletedForEveryone: false, mine: false });
  await notify({
    userId: peerId,
    type: "DM_MESSAGE",
    dedupeKey: `dm:${conversationId}`,
    payload: { conversationId, fromUserId: me.id, fromName: me.name, preview, count: 1 },
    aggregate: (existing) => ({
      ...existing,
      preview,
      fromName: me.name,
      count: (typeof existing.count === "number" ? existing.count : 1) + 1,
    }),
  });
}

// ---------- Changing messages ----------

async function loadMessageFor(me: User, messageId: string) {
  const db = getDb();
  const msg = await db.message.findUnique({ where: { id: messageId } });
  if (!msg) throw notFound();
  await accessFor(me.id, msg.conversationId);
  return msg;
}

async function reload(me: User, messageId: string): Promise<MessageDto> {
  const row = await getDb().message.findUniqueOrThrow({
    where: { id: messageId },
    include: messageInclude(me.id),
  });
  return messageDto(row, me.id);
}

export async function deleteForMe(me: User, messageId: string): Promise<void> {
  const msg = await loadMessageFor(me, messageId);
  await getDb().messageHidden.upsert({
    where: { userId_messageId: { userId: me.id, messageId: msg.id } },
    create: { userId: me.id, messageId: msg.id },
    update: {},
  });
}

export async function deleteForEveryone(me: User, messageId: string): Promise<MessageDto> {
  const msg = await loadMessageFor(me, messageId);
  const verdict = canDeleteForEveryone({
    senderId: msg.senderId,
    userId: me.id,
    createdAt: msg.createdAt,
    alreadyDeleted: msg.deletedForEveryoneAt !== null,
    now: new Date(),
  });
  if (!verdict.ok) {
    throw verdict.reason === "WINDOW_CLOSED" ? forbidden(errors.deleteWindowClosed) : forbidden();
  }
  await getDb().message.update({
    where: { id: msg.id },
    data: { deletedForEveryoneAt: new Date() },
  });
  void publish({ type: "message:updated", messageId: msg.id });
  return reload(me, msg.id);
}

export async function editMessage(me: User, messageId: string, body: string): Promise<MessageDto> {
  const msg = await loadMessageFor(me, messageId);
  const verdict = canEditMessage({
    senderId: msg.senderId,
    userId: me.id,
    type: msg.type,
    createdAt: msg.createdAt,
    deleted: msg.deletedForEveryoneAt !== null,
    now: new Date(),
  });
  if (!verdict.ok) {
    throw verdict.reason === "WINDOW_CLOSED"
      ? forbidden(errors.editWindowClosed)
      : forbidden(errors.editNotAllowed);
  }
  const access = await accessFor(me.id, msg.conversationId);
  await assertCanInteract(me.id, access.peerId);
  await enforce(policies.messages, me.id);
  const text = body.trim();
  if (!bodyIsValid("TEXT", text)) {
    throw new AppError(400, "INVALID", errors.messageTooLong(LIMITS.MESSAGE_MAX_CHARS));
  }
  if (text !== msg.body) {
    await getDb().message.update({
      where: { id: msg.id },
      data: { body: text, editedAt: new Date() },
    });
    void publish({ type: "message:updated", messageId: msg.id });
  }
  return reload(me, msg.id);
}

export async function setStar(me: User, messageId: string, on: boolean): Promise<MessageDto> {
  const msg = await loadMessageFor(me, messageId);
  const db = getDb();
  if (on) {
    await db.messageStar.upsert({
      where: { userId_messageId: { userId: me.id, messageId: msg.id } },
      create: { userId: me.id, messageId: msg.id },
      update: {},
    });
  } else {
    await db.messageStar.deleteMany({ where: { userId: me.id, messageId: msg.id } });
  }
  return reload(me, msg.id);
}

export async function toggleReaction(
  me: User,
  messageId: string,
  emoji: string,
): Promise<MessageDto> {
  if (!isSingleEmoji(emoji)) throw new AppError(400, "INVALID", errors.invalidRequest);
  const msg = await loadMessageFor(me, messageId);
  await assertCanInteract(me.id, (await accessFor(me.id, msg.conversationId)).peerId);
  const db = getDb();
  const key = { userId_messageId_emoji: { userId: me.id, messageId: msg.id, emoji } };
  const had = await db.messageReaction.findUnique({ where: key });
  if (had) await db.messageReaction.delete({ where: key });
  else await db.messageReaction.create({ data: { userId: me.id, messageId: msg.id, emoji } });
  void publish({ type: "message:updated", messageId: msg.id });
  return reload(me, msg.id);
}

// ---------- Conversation state ----------

export async function setArchived(
  me: User,
  conversationId: string,
  archived: boolean,
): Promise<void> {
  await accessFor(me.id, conversationId);
  await getDb().conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: me.id } },
    data: { archivedAt: archived ? new Date() : null },
  });
}

/** Delete chat means clear for me: history before now is hidden, the chat leaves my list (Section 9.3). */
export async function clearChat(me: User, conversationId: string): Promise<void> {
  await accessFor(me.id, conversationId);
  await getDb().conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: me.id } },
    data: { clearedAt: new Date(), archivedAt: null },
  });
  await getDb().notification.updateMany({
    where: { userId: me.id, dedupeKey: `dm:${conversationId}`, readAt: null },
    data: { readAt: new Date(), dedupeKey: null },
  });
}

export async function setMuted(
  me: User,
  conversationId: string,
  until: Date | null,
): Promise<void> {
  await accessFor(me.id, conversationId);
  await getDb().conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: me.id } },
    data: { mutedUntil: until },
  });
}

/** REST fallback for receipts when the socket is down. Same logic the realtime service uses. */
export async function acknowledge(
  me: User,
  conversationId: string,
  messageId: string,
  kind: "delivered" | "read",
): Promise<void> {
  await accessFor(me.id, conversationId);
  const result = await advanceReceipt({ userId: me.id, conversationId, messageId, kind });
  if (!result) throw notFound();
  if (kind === "read") {
    await getDb().notification.updateMany({
      where: { userId: me.id, dedupeKey: `dm:${conversationId}`, readAt: null },
      data: { readAt: new Date(), dedupeKey: null },
    });
  }
  if (result.moved) {
    void publish({
      type: "receipt",
      conversationId,
      userId: me.id,
      messageId: result.messageId,
      kind,
    });
    void publish({ type: "badge", userId: me.id });
  }
}

export async function starredMessages(
  me: User,
  cursor: string | null,
  limit: number,
): Promise<Page<MessageDto>> {
  const db = getDb();
  const after = decodeCursor(cursor, isMsgCursor);
  const rows = await db.messageStar.findMany({
    where: {
      userId: me.id,
      message: {
        conversation: { members: { some: { userId: me.id } } },
        hiddenBy: { none: { userId: me.id } },
      },
      ...(after ? { createdAt: { lt: new Date(after.t) } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { message: { include: messageInclude(me.id) } },
  });
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items: items.map((r) => messageDto(r.message, me.id)),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id })
        : null,
  };
}

/** One conversation as the list shows it, even if it is archived or was cleared. Used by the thread header. */
export async function getConversation(me: User, conversationId: string): Promise<ConversationDto> {
  const db = getDb();
  const access = await accessFor(me.id, conversationId);
  const [peer, member, last, unread] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: access.peerId } }),
    db.conversationMember.findUniqueOrThrow({
      where: { conversationId_userId: { conversationId, userId: me.id } },
    }),
    db.message.findFirst({
      where: {
        conversationId,
        hiddenBy: { none: { userId: me.id } },
        ...(access.clearedAt ? { createdAt: { gt: access.clearedAt } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: messageInclude(me.id),
    }),
    unreadByConversation(me.id),
  ]);
  return {
    id: conversationId,
    peer: toPublicUser(peer),
    lastMessage: last ? messageDto(last, me.id) : null,
    lastMessageAt: last?.createdAt.toISOString() ?? null,
    unread: unread.get(conversationId) ?? 0,
    archived: member.archivedAt !== null,
    muted: member.mutedUntil !== null && member.mutedUntil > new Date(),
    availability: (await availabilityFor(me.id, [peer])).get(peer.id) ?? "OK",
  };
}
