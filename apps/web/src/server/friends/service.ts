import { getDb, toPublicUser, type FriendRequest, type User } from "@gistroom/db";
import { errors, type FriendDto, type FriendRequestDto } from "@gistroom/shared";
import { dmKeyFor, orderedPair } from "../cursor";
import { AppError, notFound } from "../http";
import { enforce, policies } from "../rate-limit";
import { notify } from "../notifications/service";
import { publish } from "../realtime";
import { isUniqueViolation } from "../db-errors";
import { activeCooldown, decideSend, retryAfter } from "./rules";
import { areFriends, isBlockedEitherWay } from "./relations";

const unavailable = () => new AppError(409, "CONFLICT", errors.friendUnavailable);

/** Find or create the one DM between two friends. Safe to call twice at the same time. */
export async function ensureConversation(a: string, b: string): Promise<string> {
  const db = getDb();
  const dmKey = dmKeyFor(a, b);
  const existing = await db.conversation.findUnique({ where: { dmKey }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const created = await db.conversation.create({
      data: {
        dmKey,
        members: { create: [{ userId: a }, { userId: b }] },
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await db.conversation.findUniqueOrThrow({
      where: { dmKey },
      select: { id: true },
    });
    return winner.id;
  }
}

export type SendOutcome =
  | { status: "SENT"; requestId: string }
  | { status: "ACCEPTED"; requestId: string; conversationId: string }
  | { status: "ALREADY_FRIENDS" }
  | { status: "ALREADY_SENT"; requestId: string };

export async function sendRequest(me: User, targetId: string): Promise<SendOutcome> {
  const db = getDb();
  await enforce(policies.friendRequestHour, me.id).catch(() => {
    throw new AppError(429, "RATE_LIMITED", errors.friendLimitHour);
  });
  await enforce(policies.friendRequestDay, me.id).catch(() => {
    throw new AppError(429, "RATE_LIMITED", errors.friendLimitDay);
  });

  const target = await db.user.findUnique({ where: { id: targetId } });
  const now = new Date();
  const [blocked, isFriend, between] = await Promise.all([
    isBlockedEitherWay(me.id, targetId),
    areFriends(me.id, targetId),
    db.friendRequest.findMany({
      where: {
        OR: [
          { requesterId: me.id, addresseeId: targetId },
          { requesterId: targetId, addresseeId: me.id },
        ],
      },
    }),
  ]);

  const sent = between.find((r) => r.requesterId === me.id && r.status === "PENDING");
  const received = between.find((r) => r.requesterId === targetId && r.status === "PENDING");
  const decision = decideSend({
    selfId: me.id,
    targetId,
    blocked,
    isFriend,
    sentPendingId: sent?.id ?? null,
    receivedPendingId: received?.id ?? null,
    cooldownUntil: activeCooldown(
      between.filter((r) => r.requesterId === me.id && r.status === "REJECTED"),
      now,
    ),
    targetActive: Boolean(target && target.status === "ACTIVE" && target.onboardedAt),
    now,
  });

  switch (decision.action) {
    case "REFUSE":
      throw unavailable();
    case "ALREADY_FRIENDS":
      return { status: "ALREADY_FRIENDS" };
    case "ALREADY_SENT":
      return { status: "ALREADY_SENT", requestId: sent!.id };
    case "AUTO_ACCEPT": {
      const { conversationId } = await acceptRequest(me, decision.requestId);
      return { status: "ACCEPTED", requestId: decision.requestId, conversationId };
    }
    case "SEND": {
      let request: FriendRequest;
      try {
        request = await db.friendRequest.create({
          data: { requesterId: me.id, addresseeId: targetId },
        });
      } catch (error) {
        // The partial unique index stops two pending requests for one pair when both race.
        if (isUniqueViolation(error)) {
          const winner = await db.friendRequest.findFirst({
            where: { requesterId: me.id, addresseeId: targetId, status: "PENDING" },
          });
          if (winner) return { status: "ALREADY_SENT", requestId: winner.id };
        }
        throw error;
      }
      await notify({
        userId: targetId,
        type: "FRIEND_REQUEST_RECEIVED",
        dedupeKey: `fr:${request.id}`,
        payload: {
          requestId: request.id,
          fromUserId: me.id,
          fromName: me.name,
          fromUsername: me.username,
        },
      });
      void publish({ type: "friend:request", requestId: request.id });
      return { status: "SENT", requestId: request.id };
    }
  }
}

export async function acceptRequest(
  me: User,
  requestId: string,
): Promise<{ conversationId: string }> {
  const db = getDb();
  const request = await db.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.addresseeId !== me.id) throw notFound();
  if (request.status === "ACCEPTED") {
    return { conversationId: await ensureConversation(request.requesterId, request.addresseeId) };
  }
  if (request.status !== "PENDING") throw notFound();
  if (await isBlockedEitherWay(request.requesterId, me.id)) throw unavailable();

  const { low, high } = orderedPair(request.requesterId, request.addresseeId);
  await db.$transaction([
    db.friendRequest.update({
      where: { id: request.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
    db.friendship.upsert({
      where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
      create: { userLowId: low, userHighId: high },
      update: {},
    }),
    db.notification.updateMany({
      where: { userId: me.id, dedupeKey: `fr:${request.id}`, readAt: null },
      data: { readAt: new Date(), dedupeKey: null },
    }),
  ]);
  const conversationId = await ensureConversation(request.requesterId, request.addresseeId);
  await notify({
    userId: request.requesterId,
    type: "FRIEND_REQUEST_ACCEPTED",
    dedupeKey: `fra:${request.id}`,
    payload: {
      requestId: request.id,
      userId: me.id,
      name: me.name,
      username: me.username,
      conversationId,
    },
  });
  void publish({ type: "friend:accepted", requestId: request.id });
  return { conversationId };
}

/** Decline. The sender is never told, and cannot ask again for seven days (Section 9.2). */
export async function rejectRequest(me: User, requestId: string): Promise<void> {
  const db = getDb();
  const request = await db.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.addresseeId !== me.id || request.status !== "PENDING") throw notFound();
  const now = new Date();
  await db.$transaction([
    db.friendRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", respondedAt: now, retryAfter: retryAfter(now) },
    }),
    db.notification.updateMany({
      where: { userId: me.id, dedupeKey: `fr:${request.id}`, readAt: null },
      data: { readAt: now, dedupeKey: null },
    }),
  ]);
  void publish({ type: "badge", userId: me.id });
}

export async function cancelRequest(me: User, requestId: string): Promise<void> {
  const db = getDb();
  const request = await db.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.requesterId !== me.id || request.status !== "PENDING") throw notFound();
  await db.$transaction([
    db.friendRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED", respondedAt: new Date() },
    }),
    // Remove the notice from the other person's list so it does not point at nothing.
    db.notification.deleteMany({
      where: { userId: request.addresseeId, dedupeKey: `fr:${request.id}` },
    }),
  ]);
  void publish({ type: "badge", userId: request.addresseeId });
}

export async function unfriend(me: User, otherId: string): Promise<void> {
  const { low, high } = orderedPair(me.id, otherId);
  await getDb().friendship.deleteMany({ where: { userLowId: low, userHighId: high } });
}

/** A block ends the friendship, cancels pending requests either way and hides both people from search. */
export async function blockUser(me: User, otherId: string): Promise<void> {
  if (otherId === me.id) throw unavailable();
  const db = getDb();
  const other = await db.user.findUnique({ where: { id: otherId }, select: { id: true } });
  if (!other) throw notFound();
  const { low, high } = orderedPair(me.id, otherId);
  await db.$transaction([
    db.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: otherId } },
      create: { blockerId: me.id, blockedId: otherId },
      update: {},
    }),
    db.friendship.deleteMany({ where: { userLowId: low, userHighId: high } }),
    db.friendRequest.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { requesterId: me.id, addresseeId: otherId },
          { requesterId: otherId, addresseeId: me.id },
        ],
      },
      data: { status: "CANCELLED", respondedAt: new Date() },
    }),
  ]);
}

export async function unblockUser(me: User, otherId: string): Promise<void> {
  await getDb().block.deleteMany({ where: { blockerId: me.id, blockedId: otherId } });
}

export async function listFriends(me: User): Promise<FriendDto[]> {
  const db = getDb();
  const rows = await db.friendship.findMany({
    where: { OR: [{ userLowId: me.id }, { userHighId: me.id }] },
    orderBy: { createdAt: "desc" },
  });
  const otherIds = rows.map((r) => (r.userLowId === me.id ? r.userHighId : r.userLowId));
  const [users, conversations] = await Promise.all([
    db.user.findMany({ where: { id: { in: otherIds }, status: "ACTIVE" } }),
    db.conversation.findMany({
      where: { dmKey: { in: otherIds.map((id) => dmKeyFor(me.id, id)) } },
      select: { id: true, dmKey: true },
    }),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const convByKey = new Map(conversations.map((c) => [c.dmKey, c.id]));
  const out: FriendDto[] = [];
  for (const row of rows) {
    const otherId = row.userLowId === me.id ? row.userHighId : row.userLowId;
    const u = byId.get(otherId);
    if (!u) continue;
    out.push({
      user: toPublicUser(u),
      conversationId: convByKey.get(dmKeyFor(me.id, otherId)) ?? null,
      since: row.createdAt.toISOString(),
      online: null,
      lastSeenAt: null,
    });
  }
  return out.sort((a, b) => a.user.name.localeCompare(b.user.name));
}

export async function listRequests(
  me: User,
  direction: "INCOMING" | "OUTGOING",
): Promise<FriendRequestDto[]> {
  const db = getDb();
  const rows = await db.friendRequest.findMany({
    where:
      direction === "INCOMING"
        ? { addresseeId: me.id, status: "PENDING" }
        : { requesterId: me.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { requester: true, addressee: true },
  });
  return rows.map((r) => ({
    id: r.id,
    direction,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    user: toPublicUser(direction === "INCOMING" ? r.requester : r.addressee),
  }));
}
