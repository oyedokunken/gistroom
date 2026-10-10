import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  getDb,
  toPublicUser,
  type Prisma,
  type Room,
  type RoomMember,
  type User,
} from "@gistroom/db";
import {
  LIMITS,
  canActOn,
  canDo,
  errors,
  joinVerdict,
  linkExpiry,
  linkState,
  liveKitIdentity,
  nextHost,
  slugFromBytes,
  topicBySlug,
  type CreateRoomInput,
  type JoinDenied,
  type ModActionInput,
  type RoomChatDto,
  type RoomDto,
  type RoomJoin,
  type RoomMemberDto,
  type RoomModLogDto,
  type RoomRole,
} from "@gistroom/shared";
import { decodeCursor, encodeCursor } from "../cursor";
import { AppError, forbidden, notFound } from "../http";
import { areFriends, isBlockedEitherWay } from "../friends/relations";
import { closeLiveKitRoom, mintJoin, muteInLiveKit, removeFromLiveKit } from "../livekit";
import { notify } from "../notifications/service";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { accessFor, assertCanInteract, sendMessage } from "../chat/service";
import { isUniqueViolation } from "../db-errors";

type RoomRow = Room & { host: User; topic: { slug: string; name: string } | null };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const DENIED: Record<JoinDenied, { status: number; message: string }> = {
  ENDED: { status: 410, message: errors.roomEnded },
  NOT_STARTED: { status: 409, message: errors.roomNotStarted },
  NOT_INVITED: { status: 403, message: errors.roomNotInvited },
  BANNED: { status: 403, message: errors.roomBanned },
  FULL: { status: 409, message: errors.roomFull },
  LOCKED: { status: 409, message: errors.roomLocked },
};

function denied(reason: JoinDenied): AppError {
  const d = DENIED[reason];
  return new AppError(d.status, d.status === 403 ? "FORBIDDEN" : "CONFLICT", d.message);
}

async function loadBySlug(slug: string): Promise<RoomRow> {
  const room = await getDb().room.findUnique({
    where: { slug },
    include: { host: true, topic: { select: { slug: true, name: true } } },
  });
  if (!room) throw notFound();
  return room;
}

async function joinedCount(roomId: string): Promise<number> {
  return getDb().roomMember.count({ where: { roomId, state: "JOINED" } });
}

async function memberOf(roomId: string, userId: string): Promise<RoomMember | null> {
  return getDb().roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
}

async function log(
  roomId: string,
  actorId: string,
  action: Prisma.RoomModLogUncheckedCreateInput["action"],
  targetId?: string | null,
  meta?: Prisma.InputJsonValue,
) {
  await getDb().roomModLog.create({
    data: { roomId, actorId, action, targetId: targetId ?? null, meta },
  });
}

async function toDto(room: RoomRow, viewerRole: RoomRole | null): Promise<RoomDto> {
  return {
    id: room.id,
    slug: room.slug,
    title: room.title,
    description: room.description,
    topicSlug: room.topic?.slug ?? null,
    topicName: room.topic?.name ?? null,
    language: room.language,
    visibility: room.visibility,
    status: room.status,
    locked: room.locked,
    scheduledFor: room.scheduledFor?.toISOString() ?? null,
    startedAt: room.startedAt?.toISOString() ?? null,
    host: toPublicUser(room.host),
    joined: await joinedCount(room.id),
    max: room.maxParticipants,
    myRole: viewerRole,
  };
}

// ---------- Create and start ----------

export async function createRoom(me: User, input: CreateRoomInput): Promise<RoomDto> {
  await enforce(policies.roomCreate, me.id);
  const db = getDb();
  // Topics come from the shared list. The row is created the first time a room uses it.
  const info = input.topicSlug ? topicBySlug(input.topicSlug) : undefined;
  const topic = info
    ? await db.topic.upsert({
        where: { slug: info.slug },
        create: { slug: info.slug, name: info.name, description: info.description },
        update: {},
      })
    : null;
  if (input.topicSlug && !topic) throw new AppError(400, "INVALID", errors.roomTopicMissing);

  const now = new Date();
  let scheduledFor: Date | null = null;
  if (input.scheduledFor) {
    scheduledFor = new Date(input.scheduledFor);
    const limit = now.getTime() + 30 * 86_400_000;
    if (scheduledFor.getTime() <= now.getTime() + 60_000 || scheduledFor.getTime() > limit) {
      throw new AppError(400, "INVALID", errors.roomScheduleBad, {
        fields: { scheduledFor: errors.roomScheduleBad },
      });
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const room = await db.room.create({
        data: {
          slug: slugFromBytes(randomBytes(12)),
          hostId: me.id,
          title: input.title,
          topicId: topic?.id ?? null,
          language: input.language,
          description: input.description?.trim() || null,
          visibility: input.visibility,
          status: scheduledFor ? "SCHEDULED" : "LIVE",
          scheduledFor,
          startedAt: scheduledFor ? null : now,
          maxParticipants: LIMITS.ROOM_MAX_PARTICIPANTS,
          livekitRoom: `room_${randomUUID()}`,
          members: { create: { userId: me.id, role: "HOST", state: "INVITED" } },
        },
        include: { host: true, topic: { select: { slug: true, name: true } } },
      });
      return toDto(room, "HOST");
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new AppError(500, "SERVER", errors.server);
}

export async function startRoom(me: User, slug: string): Promise<RoomDto> {
  const room = await loadBySlug(slug);
  if (room.hostId !== me.id) throw forbidden(errors.roomNotAllowed);
  if (room.status === "ENDED") throw denied("ENDED");
  if (room.status === "LIVE") return toDto(room, "HOST");
  const updated = await getDb().room.update({
    where: { id: room.id },
    data: { status: "LIVE", startedAt: new Date() },
    include: { host: true, topic: { select: { slug: true, name: true } } },
  });
  void publish({ type: "room", roomId: room.id, change: "started" });
  return toDto(updated, "HOST");
}

// ---------- Viewing ----------

export type RoomView =
  | { state: "OK"; room: RoomDto }
  | { state: "NOT_INVITED" }
  | { state: "ENDED" }
  | { state: "MISSING" };

/** What the room page shows. A private room you are not in gives away nothing at all (D6). */
export async function viewRoom(
  me: User | null,
  slug: string,
  linkToken?: string | null,
): Promise<RoomView> {
  const db = getDb();
  const room = await db.room.findUnique({
    where: { slug },
    include: { host: true, topic: { select: { slug: true, name: true } } },
  });
  if (!room) return { state: "MISSING" };
  const member = me ? await memberOf(room.id, me.id) : null;
  const isHost = me?.id === room.hostId;
  const inRoom = Boolean(member && member.state !== "REMOVED" && member.state !== "BANNED");
  const linkOk = linkToken ? await linkValid(room.id, linkToken) : false;
  if (room.visibility === "PRIVATE" && !isHost && !inRoom && !linkOk) {
    return { state: "NOT_INVITED" };
  }
  if (room.status === "ENDED") return { state: "ENDED" };
  return { state: "OK", room: await toDto(room, isHost ? "HOST" : (member?.role ?? null)) };
}

async function linkValid(roomId: string, token: string): Promise<boolean> {
  const link = await getDb().roomInviteLink.findUnique({ where: { tokenHash: hash(token) } });
  if (!link || link.roomId !== roomId) return false;
  return linkState({ ...link, now: new Date() }) === "OK";
}

// ---------- Join and leave ----------

export async function joinRoom(
  me: User,
  slug: string,
  linkToken?: string | null,
): Promise<RoomJoin> {
  const db = getDb();
  const room = await loadBySlug(slug);
  const now = new Date();
  const member = await memberOf(room.id, me.id);
  const isHost = room.hostId === me.id;
  const link = linkToken
    ? await db.roomInviteLink.findUnique({ where: { tokenHash: hash(linkToken) } })
    : null;
  const linkOk = Boolean(link && link.roomId === room.id && linkState({ ...link, now }) === "OK");

  const verdict = joinVerdict({
    status: room.status,
    visibility: room.visibility,
    locked: room.locked,
    isHost,
    member: member
      ? { state: member.state, role: member.role, graceUntil: member.graceUntil }
      : null,
    linkValid: linkOk,
    joinedCount: await joinedCount(room.id),
    max: room.maxParticipants,
    now,
  });
  if (!verdict.ok) throw denied(verdict.reason);
  if (await isBlockedEitherWay(me.id, room.hostId)) throw denied("NOT_INVITED");

  // Opening a valid link adds you to the invite list once (D6).
  if (linkOk && link && !member) {
    await db.roomInviteLink.update({
      where: { id: link.id },
      data: { usedCount: { increment: 1 } },
    });
  }

  const wasIn = member?.state === "JOINED";
  await db.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId: me.id } },
    create: {
      roomId: room.id,
      userId: me.id,
      role: verdict.role,
      state: "JOINED",
      joinedAt: now,
      invitedById: link?.createdById ?? null,
    },
    update: {
      state: "JOINED",
      role: verdict.role,
      leftAt: null,
      graceUntil: null,
      ...(wasIn
        ? {}
        : { joinedAt: member?.joinedAt && member.state === "LEFT" ? member.joinedAt : now }),
    },
  });
  void publish({ type: "room", roomId: room.id, change: "member", userId: me.id });

  const { token, url } = mintJoin({
    identity: liveKitIdentity(me.id),
    name: me.name,
    room: room.livekitRoom,
  });
  return { room: await toDto(room, verdict.role), token, url, role: verdict.role };
}

/** Leaving keeps your seat for 120 seconds. If the host leaves, the room passes to someone else. */
export async function leaveRoom(me: User, slug: string): Promise<void> {
  const db = getDb();
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (!member || member.state !== "JOINED") return;
  const now = new Date();
  await db.roomMember.update({
    where: { id: member.id },
    data: {
      state: "LEFT",
      leftAt: now,
      graceUntil: new Date(now.getTime() + LIMITS.ROOM_REJOIN_GRACE_SEC * 1000),
    },
  });

  if (room.hostId === me.id && room.status === "LIVE") {
    const present = await db.roomMember.findMany({ where: { roomId: room.id, state: "JOINED" } });
    const heir = nextHost(
      present.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt })),
      me.id,
    );
    if (heir) {
      await db.$transaction([
        db.room.update({ where: { id: room.id }, data: { hostId: heir } }),
        db.roomMember.updateMany({
          where: { roomId: room.id, userId: heir },
          data: { role: "HOST" },
        }),
        db.roomMember.update({ where: { id: member.id }, data: { role: "MEMBER" } }),
      ]);
      await log(room.id, me.id, "PROMOTE", heir, { transfer: true });
      void publish({ type: "room", roomId: room.id, change: "member", userId: heir });
    }
  }
  void publish({ type: "room", roomId: room.id, change: "member", userId: me.id });

  if ((await joinedCount(room.id)) === 0 && room.status === "LIVE") {
    await db.scheduledJob.create({
      data: {
        kind: "room-empty",
        dueAt: new Date(now.getTime() + LIMITS.ROOM_EMPTY_END_GRACE_SEC * 1000),
        payload: { roomId: room.id } satisfies Prisma.InputJsonValue,
      },
    });
  }
}

async function finishRoom(room: Room, actorId: string | null): Promise<void> {
  const db = getDb();
  const now = new Date();
  const claimed = await db.room.updateMany({
    where: { id: room.id, status: { not: "ENDED" } },
    data: { status: "ENDED", endedAt: now },
  });
  if (claimed.count === 0) return;
  const members = await db.roomMember.findMany({ where: { roomId: room.id } });
  const attended = members.filter((m) => m.joinedAt !== null);
  if (attended.length > 0) {
    await db.callLogEntry.createMany({
      data: attended.map((m) => ({
        userId: m.userId,
        kind: "ROOM" as const,
        direction: "NONE" as const,
        outcome: "ANSWERED" as const,
        mediaType: "AUDIO" as const,
        roomId: room.id,
        titleSnapshot: room.title,
        searchText: room.title.toLowerCase(),
        startedAt: m.joinedAt ?? room.startedAt ?? now,
        durationSec: Math.max(
          0,
          Math.round(((m.leftAt ?? now).getTime() - (m.joinedAt ?? now).getTime()) / 1000),
        ),
      })),
    });
  }
  await db.roomMember.updateMany({
    where: { roomId: room.id, state: "JOINED" },
    data: { state: "LEFT", leftAt: now, graceUntil: null },
  });
  await db.roomMessage.updateMany({
    where: { roomId: room.id },
    data: { expiresAt: new Date(now.getTime() + LIMITS.ROOM_CHAT_RETENTION_HOURS * 3_600_000) },
  });
  if (actorId) await log(room.id, actorId, "END");
  void closeLiveKitRoom(room.livekitRoom);
  void publish({ type: "room", roomId: room.id, change: "ended" });
}

export async function endRoom(me: User, slug: string): Promise<void> {
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  const role: RoomRole | null = room.hostId === me.id ? "HOST" : (member?.role ?? null);
  if (!canDo(role, "END")) throw forbidden(errors.roomNotAllowed);
  await finishRoom(room, me.id);
}

/** Ends live rooms that stayed empty past the 60 second grace. Safe to run often. */
export async function endEmptyRooms(now = new Date()): Promise<number> {
  const db = getDb();
  const live = await db.room.findMany({
    where: { status: "LIVE", members: { none: { state: "JOINED" } } },
    include: { members: { select: { leftAt: true } } },
    take: 100,
  });
  let ended = 0;
  for (const room of live) {
    const lastLeft = room.members.reduce<number>(
      (max, m) => Math.max(max, m.leftAt?.getTime() ?? 0),
      0,
    );
    const quietFor = now.getTime() - Math.max(lastLeft, room.startedAt?.getTime() ?? 0);
    if (quietFor >= LIMITS.ROOM_EMPTY_END_GRACE_SEC * 1000) {
      await finishRoom(room, null);
      ended += 1;
    }
  }
  return ended;
}

// ---------- People and moderation ----------

async function actorRole(room: Room, userId: string): Promise<RoomRole | null> {
  if (room.hostId === userId) return "HOST";
  const m = await memberOf(room.id, userId);
  return m && m.state === "JOINED" ? m.role : null;
}

export async function listMembers(me: User, slug: string): Promise<RoomMemberDto[]> {
  const room = await loadBySlug(slug);
  if (!(await actorRole(room, me.id))) throw notFound();
  const rows = await getDb().roomMember.findMany({
    where: { roomId: room.id, state: "JOINED" },
    include: { user: true },
    orderBy: [{ joinedAt: "asc" }],
  });
  return rows.map((m) => ({ user: toPublicUser(m.user), role: m.role, state: m.state }));
}

export async function moderate(me: User, slug: string, input: ModActionInput): Promise<void> {
  await enforce(policies.roomMod, me.id);
  const db = getDb();
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  const ability = (
    {
      MUTE: "MUTE",
      REMOVE: "REMOVE",
      BAN: "BAN",
      PROMOTE: "PROMOTE",
      DEMOTE: "DEMOTE",
      TRANSFER: "TRANSFER",
    } as const
  )[input.action];
  if (!role || !canDo(role, ability)) throw forbidden(errors.roomNotAllowed);

  const target = await memberOf(room.id, input.userId);
  if (!target || target.userId === me.id) throw new AppError(404, "NOT_FOUND", errors.roomNotHere);
  if (input.action !== "BAN" && target.state !== "JOINED") {
    throw new AppError(404, "NOT_FOUND", errors.roomNotHere);
  }
  const targetRole: RoomRole = room.hostId === target.userId ? "HOST" : target.role;
  if (!canActOn(role, targetRole) && input.action !== "TRANSFER")
    throw forbidden(errors.roomNotAllowed);

  const identity = liveKitIdentity(target.userId);
  switch (input.action) {
    case "MUTE":
      await muteInLiveKit(room.livekitRoom, identity);
      await log(room.id, me.id, "MUTE", target.userId);
      break;
    case "REMOVE":
      await db.roomMember.update({
        where: { id: target.id },
        data: { state: "REMOVED", leftAt: new Date(), graceUntil: null },
      });
      void removeFromLiveKit(room.livekitRoom, identity);
      await log(room.id, me.id, "REMOVE", target.userId);
      break;
    case "BAN":
      await db.roomMember.update({
        where: { id: target.id },
        data: { state: "BANNED", leftAt: new Date(), graceUntil: null },
      });
      void removeFromLiveKit(room.livekitRoom, identity);
      await log(room.id, me.id, "BAN", target.userId);
      break;
    case "PROMOTE":
      if (target.role !== "MEMBER") throw forbidden(errors.roomNotAllowed);
      await db.roomMember.update({ where: { id: target.id }, data: { role: "MODERATOR" } });
      await log(room.id, me.id, "PROMOTE", target.userId);
      void notify({
        userId: target.userId,
        type: "ROOM_ROLE_CHANGED",
        payload: { roomSlug: room.slug, role: "moderator", roomTitle: room.title },
      }).catch(() => null);
      break;
    case "DEMOTE":
      if (target.role !== "MODERATOR") throw forbidden(errors.roomNotAllowed);
      await db.roomMember.update({ where: { id: target.id }, data: { role: "MEMBER" } });
      await log(room.id, me.id, "DEMOTE", target.userId);
      break;
    case "TRANSFER":
      await db.$transaction([
        db.room.update({ where: { id: room.id }, data: { hostId: target.userId } }),
        db.roomMember.update({ where: { id: target.id }, data: { role: "HOST" } }),
        db.roomMember.updateMany({
          where: { roomId: room.id, userId: me.id },
          data: { role: "MODERATOR" },
        }),
      ]);
      await log(room.id, me.id, "PROMOTE", target.userId, { transfer: true });
      break;
  }
  void publish({ type: "room", roomId: room.id, change: "member", userId: target.userId });
}

export async function muteAll(me: User, slug: string): Promise<void> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "MUTE_ALL")) throw forbidden(errors.roomNotAllowed);
  await muteInLiveKit(room.livekitRoom, null, [liveKitIdentity(me.id)]);
  await log(room.id, me.id, "MUTE_ALL");
}

export async function setLocked(me: User, slug: string, locked: boolean): Promise<RoomDto> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "LOCK")) throw forbidden(errors.roomNotAllowed);
  const updated = await getDb().room.update({
    where: { id: room.id },
    data: { locked },
    include: { host: true, topic: { select: { slug: true, name: true } } },
  });
  await log(room.id, me.id, locked ? "LOCK" : "UNLOCK");
  void publish({ type: "room", roomId: room.id, change: "locked" });
  return toDto(updated, role);
}

export async function modLog(me: User, slug: string): Promise<RoomModLogDto[]> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "SEE_LOG")) throw forbidden(errors.roomNotAllowed);
  const rows = await getDb().roomModLog.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const ids = [
    ...new Set(rows.flatMap((r) => [r.actorId, r.targetId].filter((v): v is string => !!v))),
  ];
  const users = ids.length ? await getDb().user.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(users.map((u) => [u.id, toPublicUser(u)]));
  return rows.flatMap((r) => {
    const actor = byId.get(r.actorId);
    if (!actor) return [];
    return [
      {
        id: r.id,
        actor,
        target: r.targetId ? (byId.get(r.targetId) ?? null) : null,
        action: r.action,
        createdAt: r.createdAt.toISOString(),
      },
    ];
  });
}

// ---------- Invites, links and forwarding ----------

export async function inviteFriend(me: User, slug: string, userId: string): Promise<void> {
  await enforce(policies.roomInvite, me.id);
  const db = getDb();
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "INVITE")) throw forbidden(errors.roomNotAllowed);
  if (room.status === "ENDED") throw denied("ENDED");
  if (!(await areFriends(me.id, userId)) || (await isBlockedEitherWay(me.id, userId))) {
    throw forbidden(errors.notFriends);
  }
  const existing = await memberOf(room.id, userId);
  if (existing?.state === "BANNED") throw forbidden(errors.roomNotAllowed);
  if (!existing || existing.state === "REMOVED") {
    await db.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId } },
      create: { roomId: room.id, userId, state: "INVITED", invitedById: me.id },
      update: { state: "INVITED", invitedById: me.id },
    });
  }
  await log(room.id, me.id, "INVITE", userId);
  await notify({
    userId,
    type: "ROOM_INVITE",
    payload: {
      roomId: room.id,
      roomSlug: room.slug,
      roomTitle: room.title,
      fromName: me.name,
    },
    dedupeKey: `room-invite:${room.id}`,
  }).catch(() => null);
  void publish({ type: "room", roomId: room.id, change: "invite", userId });
}

export async function createInviteLink(
  me: User,
  slug: string,
  input: { hours: number; maxUses?: number | null },
): Promise<{ id: string; url: string; expiresAt: string }> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "LINK")) throw forbidden(errors.roomNotAllowed);
  if (room.status === "ENDED") throw denied("ENDED");
  const token = randomBytes(24).toString("base64url");
  const link = await getDb().roomInviteLink.create({
    data: {
      roomId: room.id,
      tokenHash: hash(token),
      createdById: me.id,
      expiresAt: linkExpiry(input.hours, new Date()),
      maxUses: input.maxUses ?? null,
    },
  });
  await log(room.id, me.id, "LINK_CREATED");
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    id: link.id,
    url: `${base}/rooms/${room.slug}?invite=${token}`,
    expiresAt: link.expiresAt.toISOString(),
  };
}

export async function revokeInviteLink(me: User, slug: string, linkId: string): Promise<void> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "LINK")) throw forbidden(errors.roomNotAllowed);
  const done = await getDb().roomInviteLink.updateMany({
    where: { id: linkId, roomId: room.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (done.count > 0) await log(room.id, me.id, "LINK_REVOKED");
}

export async function listInviteLinks(me: User, slug: string) {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "LINK")) throw forbidden(errors.roomNotAllowed);
  const now = new Date();
  const rows = await getDb().roomInviteLink.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((l) => ({
    id: l.id,
    expiresAt: l.expiresAt.toISOString(),
    maxUses: l.maxUses,
    usedCount: l.usedCount,
    state: linkState({ ...l, now }),
  }));
}

/** Send the room to friends in their chats. A private room also invites them (Section 9.6). */
export async function forwardRoom(
  me: User,
  slug: string,
  conversationIds: string[],
): Promise<{ sent: number }> {
  await enforce(policies.roomInvite, me.id);
  const db = getDb();
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "INVITE")) throw forbidden(errors.roomNotAllowed);
  if (room.status === "ENDED") throw denied("ENDED");
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let sent = 0;
  for (const conversationId of conversationIds) {
    const access = await accessFor(me.id, conversationId);
    await assertCanInteract(me.id, access.peerId);
    if (room.visibility === "PRIVATE") {
      const existing = await memberOf(room.id, access.peerId);
      if (existing?.state === "BANNED") continue;
      if (!existing || existing.state === "REMOVED") {
        await db.roomMember.upsert({
          where: { roomId_userId: { roomId: room.id, userId: access.peerId } },
          create: { roomId: room.id, userId: access.peerId, state: "INVITED", invitedById: me.id },
          update: { state: "INVITED", invitedById: me.id },
        });
        await log(room.id, me.id, "INVITE", access.peerId);
      }
    }
    await sendMessage(me, conversationId, {
      clientId: `room-${room.id}-${randomUUID()}`,
      type: "ROOM_INVITE",
      body: `${base}/app/rooms/${room.slug}`,
      meta: { roomSlug: room.slug, title: room.title, visibility: room.visibility },
    });
    sent += 1;
  }
  return { sent };
}

// ---------- Room chat ----------

const chatDto = (
  row: { id: string; clientId: string; body: string; createdAt: Date },
  sender: User,
): RoomChatDto => ({
  id: row.id,
  clientId: row.clientId,
  sender: toPublicUser(sender),
  body: row.body,
  createdAt: row.createdAt.toISOString(),
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
  const existing = await db.roomMessage.findUnique({
    where: { senderId_clientId: { senderId: me.id, clientId: input.clientId } },
  });
  if (existing) return chatDto(existing, me);
  const row = await db.roomMessage.create({
    data: { roomId: room.id, senderId: me.id, clientId: input.clientId, body: input.body },
  });
  void publish({ type: "room", roomId: room.id, change: "chat", messageId: row.id });
  return chatDto(row, me);
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
  const after = decodeCursor(cursor, isChatCursor);
  const rows = await db.roomMessage.findMany({
    where: {
      roomId: room.id,
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
  const items = page.flatMap((r) => {
    const s = byId.get(r.senderId);
    return s ? [chatDto(r, s)] : [];
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

export async function deleteRoomMessage(me: User, slug: string, messageId: string): Promise<void> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "DELETE_MESSAGE")) throw forbidden(errors.roomNotAllowed);
  const done = await getDb().roomMessage.deleteMany({ where: { id: messageId, roomId: room.id } });
  if (done.count === 0) return;
  await log(room.id, me.id, "MESSAGE_DELETED", null, { messageId });
  void publish({ type: "room", roomId: room.id, change: "chat-deleted", messageId });
}

// ---------- Mine ----------

/** Rooms you host or were invited to that are not over. */
export async function myRooms(me: User): Promise<RoomDto[]> {
  const rows = await getDb().room.findMany({
    where: {
      status: { in: ["LIVE", "SCHEDULED"] },
      OR: [
        { hostId: me.id },
        { members: { some: { userId: me.id, state: { in: ["INVITED", "JOINED", "LEFT"] } } } },
      ],
    },
    include: {
      host: true,
      topic: { select: { slug: true, name: true } },
      members: { where: { userId: me.id } },
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }, { scheduledFor: "asc" }],
    take: 30,
  });
  return Promise.all(
    rows.map((r) => toDto(r, r.hostId === me.id ? "HOST" : (r.members[0]?.role ?? null))),
  );
}

/** Deletes room chat past its 24 hour keep time. Run by the daily sweep. */
export async function purgeExpiredRoomChat(now = new Date()): Promise<number> {
  const done = await getDb().roomMessage.deleteMany({ where: { expiresAt: { lte: now } } });
  return done.count;
}
