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
  type RoomLinkDto,
  type RoomMemberDto,
  type RoomModLogDto,
  type RoomRole,
  type RoomSettingsInput,
  type RoomSummaryDto,
  isReactionEmoji,
} from "@gistroom/shared";
import { decodeCursor, encodeCursor } from "../cursor";
import { AppError, forbidden, notFound } from "../http";
import { areFriends, isBlockedEitherWay } from "../friends/relations";
import {
  closeLiveKitRoom,
  mintJoin,
  muteInLiveKit,
  removeFromLiveKit,
  setPublishSources,
  type PublishSource,
} from "../livekit";
import { notify } from "../notifications/service";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { accessFor, assertCanInteract, sendMessage } from "../chat/service";
import { ensureConversation } from "../friends/service";
import { recordActivity } from "../notifications/activity";
import { emailRoomEnded, emailRoomInvite } from "../mail/notify-email";
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

async function toDto(room: RoomRow, viewerRole: RoomRole | null, going = false): Promise<RoomDto> {
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
    media: room.media === "VIDEO" ? "VIDEO" : "AUDIO",
    settings: {
      cameraAllowed: room.cameraAllowed,
      joinMuted: room.joinMuted,
      chatMode: room.chatMode,
      reactionsOn: room.reactionsOn,
      slowModeSec: room.slowModeSec,
      membersCanShare: room.membersCanShare,
      unmuteLocked: room.unmuteLocked,
    },
    myRole: viewerRole,
    going,
  };
}

/**
 * What a person may publish. Moderators and the host always may everything. Members lose the microphone while
 * "only moderators can unmute" is on, and the camera while cameras are not allowed.
 */
function publishSources(room: Room, role: RoomRole): PublishSource[] {
  const all: PublishSource[] = ["microphone", "camera", "screen_share"];
  if (role !== "MEMBER") return all;
  return all.filter((s) => {
    if (s === "microphone") return !room.unmuteLocked;
    if (s === "camera") return room.cameraAllowed;
    return true;
  });
}

/** Push the current rules to everyone inside, so a settings change works at once. */
async function applyPublishRules(room: Room): Promise<void> {
  const members = await getDb().roomMember.findMany({
    where: { roomId: room.id, state: "JOINED", role: "MEMBER", userId: { not: room.hostId } },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await setPublishSources(
    room.livekitRoom,
    members.map((m) => liveKitIdentity(m.userId)),
    publishSources(room, "MEMBER"),
  );
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
          media: input.media,
          status: scheduledFor ? "SCHEDULED" : "LIVE",
          scheduledFor,
          startedAt: scheduledFor ? null : now,
          maxParticipants: LIMITS.ROOM_MAX_PARTICIPANTS,
          livekitRoom: `room_${randomUUID()}`,
          members: { create: { userId: me.id, role: "HOST", state: "INVITED" } },
        },
        include: { host: true, topic: { select: { slug: true, name: true } } },
      });
      void recordActivity({
        userId: me.id,
        kind: "room-started",
        text: scheduledFor ? `You scheduled "${room.title}".` : `You started "${room.title}".`,
        href: `/app/rooms/${room.slug}`,
      }).catch(() => null);
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
  // Everyone who said they are coming hears it now. The dedupe key keeps it to one notice each.
  const waiting = await getDb().roomMember.findMany({
    where: { roomId: room.id, state: "INVITED", userId: { not: me.id } },
    select: { userId: true },
  });
  for (const w of waiting) {
    void notify({
      userId: w.userId,
      type: "ROOM_STARTING",
      payload: { roomId: room.id, roomSlug: room.slug, roomTitle: room.title, live: true },
      dedupeKey: `room-live:${room.id}`,
    }).catch(() => null);
  }
  return toDto(updated, "HOST");
}

/**
 * "Remind me" on a scheduled room. It puts the person on the list of people who are coming, so they get a notice
 * when the host starts it. Private rooms already have their list, so only a public room takes new names.
 */
export async function setGoing(me: User, slug: string, going: boolean): Promise<RoomDto> {
  await enforce(policies.roomGoing, me.id);
  const db = getDb();
  const room = await db.room.findUnique({
    where: { slug },
    include: { host: true, topic: { select: { slug: true, name: true } } },
  });
  if (!room || room.status === "ENDED") throw notFound();
  if (room.hostId === me.id) return toDto(room, "HOST");
  if (await isBlockedEitherWay(me.id, room.hostId)) throw denied("NOT_INVITED");
  const member = await memberOf(room.id, me.id);
  if (going) {
    if (room.visibility === "PRIVATE" && !member) throw denied("NOT_INVITED");
    if (member?.state === "BANNED") throw denied("BANNED");
    if (!member) {
      await db.roomMember.create({
        data: { roomId: room.id, userId: me.id, role: "MEMBER", state: "INVITED" },
      });
    }
  } else if (member?.state === "INVITED" && room.visibility === "PUBLIC") {
    await db.roomMember.delete({ where: { id: member.id } });
  }
  const now = await memberOf(room.id, me.id);
  return toDto(room, now?.role ?? null, now?.state === "INVITED");
}

// ---------- Viewing ----------

export type RoomView =
  | { state: "OK"; room: RoomDto }
  | { state: "NOT_INVITED" }
  | { state: "LINK_INVALID" }
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
  if (linkToken && !linkOk && !isHost && !inRoom) return { state: "LINK_INVALID" };
  if (room.visibility === "PRIVATE" && !isHost && !inRoom && !linkOk) {
    return { state: "NOT_INVITED" };
  }
  if (room.status === "ENDED") return { state: "ENDED" };
  const going = !isHost && member?.state === "INVITED";
  return {
    state: "OK",
    room: await toDto(room, isHost ? "HOST" : (member?.role ?? null), going),
  };
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

  const present = await joinedCount(room.id);
  if (present > room.peakParticipants) {
    await db.room.update({ where: { id: room.id }, data: { peakParticipants: present } });
  }
  const { token, url } = mintJoin({
    identity: liveKitIdentity(me.id),
    name: me.name,
    room: room.livekitRoom,
    canPublishSources: publishSources(room, verdict.role),
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
        mediaType: room.media === "VIDEO" ? ("VIDEO" as const) : ("AUDIO" as const),
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
  // The chat goes with the room. Reports already hold their own evidence snapshot, and the totals stay on the room.
  await db.roomMessage.deleteMany({ where: { roomId: room.id } });
  if (actorId) await log(room.id, actorId, "END");
  void emailRoomEnded(room.hostId, {
    slug: room.slug,
    title: room.title,
    durationSec: Math.max(
      0,
      Math.round((now.getTime() - (room.startedAt ?? now).getTime()) / 1000),
    ),
    peak: room.peakParticipants,
    attendees: attended.length,
    messages: room.messageCount,
  });
  for (const m of attended) {
    void notify({
      userId: m.userId,
      type: "ROOM_ENDED",
      payload: { roomId: room.id, roomSlug: room.slug, roomTitle: room.title },
      dedupeKey: `room-ended:${room.id}`,
    }).catch(() => null);
  }
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

async function roleIn(room: Room, userId: string): Promise<RoomRole> {
  if (room.hostId === userId) return "HOST";
  return (await memberOf(room.id, userId))?.role ?? "MEMBER";
}

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
      MUTE_VIDEO: "MUTE_VIDEO",
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
      void publish({
        type: "room",
        roomId: room.id,
        change: "muted",
        userId: target.userId,
        kind: "audio",
      });
      break;
    case "MUTE_VIDEO":
      await muteInLiveKit(room.livekitRoom, identity, [], "video");
      await log(room.id, me.id, "MUTE_VIDEO", target.userId);
      void publish({
        type: "room",
        roomId: room.id,
        change: "muted",
        userId: target.userId,
        kind: "video",
      });
      break;
    case "REMOVE":
      await db.roomMember.update({
        where: { id: target.id },
        data: { state: "REMOVED", leftAt: new Date(), graceUntil: null },
      });
      void removeFromLiveKit(room.livekitRoom, identity);
      await log(room.id, me.id, "REMOVE", target.userId);
      void notify({
        userId: target.userId,
        type: "ROOM_ROLE_CHANGED",
        payload: { roomSlug: room.slug, role: "removed", roomTitle: room.title },
      }).catch(() => null);
      break;
    case "BAN":
      await db.roomMember.update({
        where: { id: target.id },
        data: { state: "BANNED", leftAt: new Date(), graceUntil: null },
      });
      void removeFromLiveKit(room.livekitRoom, identity);
      await log(room.id, me.id, "BAN", target.userId);
      void notify({
        userId: target.userId,
        type: "ROOM_ROLE_CHANGED",
        payload: { roomSlug: room.slug, role: "banned", roomTitle: room.title },
      }).catch(() => null);
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
      void notify({
        userId: target.userId,
        type: "ROOM_ROLE_CHANGED",
        payload: { roomSlug: room.slug, role: "member", roomTitle: room.title },
      }).catch(() => null);
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

/** Mutes every microphone except the host and moderators. Optionally only moderators can unmute people after. */
export async function muteAll(
  me: User,
  slug: string,
  options: { lockUnmute?: boolean } = {},
): Promise<void> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "MUTE_ALL")) throw forbidden(errors.roomNotAllowed);
  const privileged = await getDb().roomMember.findMany({
    where: { roomId: room.id, role: { in: ["HOST", "MODERATOR"] } },
    select: { userId: true },
  });
  const keep = new Set(privileged.map((m) => liveKitIdentity(m.userId)));
  keep.add(liveKitIdentity(me.id));
  keep.add(liveKitIdentity(room.hostId));
  await muteInLiveKit(room.livekitRoom, null, [...keep]);
  if (options.lockUnmute) {
    const locked = await getDb().room.update({
      where: { id: room.id },
      data: { unmuteLocked: true },
    });
    await applyPublishRules(locked);
  }
  await log(room.id, me.id, "MUTE_ALL", null, { lockUnmute: Boolean(options.lockUnmute) });
  void publish({ type: "room", roomId: room.id, change: "muted", kind: "all", userId: me.id });
  void publish({ type: "room", roomId: room.id, change: "settings" });
}

// ---------- Settings ----------

/** Change settings live. The host and moderators only, logged, and everyone inside is told to refetch. */
export async function updateSettings(
  me: User,
  slug: string,
  input: RoomSettingsInput,
): Promise<RoomDto> {
  await enforce(policies.roomMod, me.id);
  const db = getDb();
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "SETTINGS")) throw forbidden(errors.roomNotAllowed);
  if (room.status === "ENDED") throw denied("ENDED");

  const data: Prisma.RoomUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.language !== undefined) data.language = input.language;
  if (input.visibility !== undefined) data.visibility = input.visibility;
  if (input.cameraAllowed !== undefined) data.cameraAllowed = input.cameraAllowed;
  if (input.joinMuted !== undefined) data.joinMuted = input.joinMuted;
  if (input.chatMode !== undefined) data.chatMode = input.chatMode;
  if (input.reactionsOn !== undefined) data.reactionsOn = input.reactionsOn;
  if (input.slowModeSec !== undefined) data.slowModeSec = input.slowModeSec;
  if (input.membersCanShare !== undefined) data.membersCanShare = input.membersCanShare;
  if (input.unmuteLocked !== undefined) data.unmuteLocked = input.unmuteLocked;
  if (input.topicSlug !== undefined) {
    if (input.topicSlug === null) data.topicId = null;
    else {
      const info = topicBySlug(input.topicSlug);
      if (!info) throw new AppError(400, "INVALID", errors.roomTopicMissing);
      const topic = await db.topic.upsert({
        where: { slug: info.slug },
        create: { slug: info.slug, name: info.name, description: info.description },
        update: {},
      });
      data.topicId = topic.id;
    }
  }
  const updated = await db.room.update({
    where: { id: room.id },
    data,
    include: { host: true, topic: { select: { slug: true, name: true } } },
  });
  if (input.unmuteLocked !== undefined || input.cameraAllowed !== undefined) {
    await applyPublishRules(updated);
  }
  await log(room.id, me.id, "SETTINGS", null, { changed: Object.keys(input) });
  void publish({ type: "room", roomId: room.id, change: "settings" });
  return toDto(updated, role);
}

/** Floating reactions. Only counted for the summary, never stored per person. Throttled per person. */
export async function sendRoomReaction(me: User, slug: string, emoji: string): Promise<void> {
  await enforce(policies.roomReaction, me.id);
  if (!isReactionEmoji(emoji)) throw new AppError(400, "INVALID", errors.roomNotAllowed);
  const db = getDb();
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (room.status !== "LIVE" || member?.state !== "JOINED") throw forbidden(errors.roomNotAllowed);
  if (!room.reactionsOn) throw forbidden(errors.roomNotAllowed);
  await db.room.update({ where: { id: room.id }, data: { reactionCount: { increment: 1 } } });
  void publish({ type: "room", roomId: room.id, change: "reaction", userId: me.id, emoji });
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
  void emailRoomInvite(me, await factsOf(room), userId);
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
      token,
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

/** Private rooms: host and moderators only. Public rooms: any member, unless the host turned sharing off. */
function canShareLink(room: Room, role: RoomRole | null): boolean {
  if (canDo(role, "LINK")) return true;
  return room.visibility === "PUBLIC" && room.membersCanShare && role !== null;
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

/** Active links only, shown in full to the people allowed to share them. */
export async function listInviteLinks(me: User, slug: string): Promise<RoomLinkDto[]> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "LINK")) throw forbidden(errors.roomNotAllowed);
  const now = new Date();
  const base = appBase();
  const rows = await getDb().roomInviteLink.findMany({
    where: { roomId: room.id, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows
    .map((l) => ({
      id: l.id,
      url: l.token ? `${base}/rooms/${room.slug}?invite=${l.token}` : "",
      expiresAt: l.expiresAt.toISOString(),
      maxUses: l.maxUses,
      usedCount: l.usedCount,
      state: linkState({ ...l, now }),
    }))
    .filter((l) => l.state === "OK" && l.url);
}

async function factsOf(room: Room) {
  const full = await getDb().room.findUniqueOrThrow({
    where: { id: room.id },
    include: { host: true, topic: { select: { name: true } } },
  });
  return {
    id: full.id,
    slug: full.slug,
    title: full.title,
    topicName: full.topic?.name ?? null,
    hostName: full.host.name,
    scheduledFor: full.scheduledFor,
    status: full.status,
  };
}

const appBase = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** The plain room link, for public rooms. Members can share it unless the host turned that off. */
export async function roomShareLink(me: User, slug: string): Promise<{ url: string | null }> {
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (room.visibility !== "PUBLIC" || !canShareLink(room, role)) return { url: null };
  return { url: `${appBase()}/rooms/${room.slug}` };
}

export interface InviteResult {
  userId: string;
  ok: boolean;
  reason?: string;
}

/** Invite several friends at once. Each gets the room as a card in their chat, and a private room adds them to the list. */
export async function inviteFriends(
  me: User,
  slug: string,
  userIds: string[],
): Promise<InviteResult[]> {
  await enforce(policies.roomInvite, me.id);
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canShareLink(room, role) && !canDo(role, "INVITE")) throw forbidden(errors.roomNotAllowed);
  if (room.status === "ENDED") throw denied("ENDED");
  const results: InviteResult[] = [];
  for (const userId of userIds) {
    try {
      if (!(await areFriends(me.id, userId)) || (await isBlockedEitherWay(me.id, userId))) {
        results.push({ userId, ok: false, reason: errors.notFriends });
        continue;
      }
      const already = await memberOf(room.id, userId);
      if (already?.state === "JOINED" || room.hostId === userId) {
        results.push({ userId, ok: false, reason: errors.roomAlreadyIn });
        continue;
      }
      const conversationId = await ensureConversation(me.id, userId);
      await forwardRoom(me, slug, [conversationId]);
      await notify({
        userId,
        type: "ROOM_INVITE",
        payload: { roomId: room.id, roomSlug: room.slug, roomTitle: room.title, fromName: me.name },
        dedupeKey: `room-invite:${room.id}`,
      }).catch(() => null);
      void emailRoomInvite(me, await factsOf(room), userId);
      void publish({ type: "room", roomId: room.id, change: "invite", userId });
      results.push({ userId, ok: true });
    } catch (e) {
      results.push({
        userId,
        ok: false,
        reason: e instanceof AppError ? e.message : errors.server,
      });
    }
  }
  const sent = results.filter((r) => r.ok).length;
  if (sent > 0) {
    void recordActivity({
      userId: me.id,
      kind: "room-invited",
      text: `You invited ${sent} ${sent === 1 ? "friend" : "friends"} to "${room.title}".`,
      href: `/app/rooms/${room.slug}`,
    }).catch(() => null);
  }
  return results;
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
  if (!canDo(role, "INVITE") && !canShareLink(room, role)) throw forbidden(errors.roomNotAllowed);
  if (room.status === "ENDED") throw denied("ENDED");
  const base = appBase();
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
      meta: {
        roomSlug: room.slug,
        title: room.title,
        visibility: room.visibility,
        topic: room.topic?.name ?? null,
        host: room.host.name,
        media: room.media,
        scheduledFor: room.scheduledFor?.toISOString() ?? null,
      },
    });
    sent += 1;
  }
  return { sent };
}

// ---------- Room chat ----------

const chatDto = (
  row: { id: string; clientId: string; body: string; createdAt: Date },
  sender: User,
  senderRole: RoomRole,
  reactions: RoomChatDto["reactions"] = [],
): RoomChatDto => ({
  id: row.id,
  clientId: row.clientId,
  sender: toPublicUser(sender),
  senderRole,
  body: row.body,
  createdAt: row.createdAt.toISOString(),
  reactions,
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
  if (existing) return chatDto(existing, me, role);
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
  return chatDto(row, me, role);
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
  await db.roomMessage.delete({ where: { id: row.id } });
  if (!own) await log(room.id, me.id, "MESSAGE_DELETED", row.senderId, { messageId });
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

// ---------- Summary and past rooms ----------

/** What an ended room leaves behind. Attendees see who was there. Only the host sees moderator actions. */
export async function roomSummary(me: User, slug: string): Promise<RoomSummaryDto> {
  const db = getDb();
  const room = await db.room.findUnique({
    where: { slug },
    include: {
      host: true,
      topic: { select: { name: true, slug: true } },
      members: { include: { user: true } },
    },
  });
  if (!room || room.status !== "ENDED") throw notFound();
  const attendeesRows = room.members.filter((m) => m.joinedAt !== null);
  const attended = attendeesRows.some((m) => m.userId === me.id) || room.hostId === me.id;
  const isHost = room.hostId === me.id;
  if (room.visibility === "PRIVATE" && !attended) throw notFound();
  const started = room.startedAt ?? room.createdAt;
  const ended = room.endedAt ?? started;
  const notes = attended
    ? await db.note.findMany({
        where: { userId: me.id, roomId: room.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  return {
    slug: room.slug,
    title: room.title,
    topicName: room.topic?.name ?? null,
    topicSlug: room.topic?.slug ?? null,
    media: room.media === "VIDEO" ? "VIDEO" : "AUDIO",
    host: toPublicUser(room.host),
    startedAt: room.startedAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    durationSec: Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)),
    peakParticipants: room.peakParticipants,
    attendeeCount: attendeesRows.length,
    messageCount: room.messageCount,
    reactionCount: room.reactionCount,
    attendees: attended ? attendeesRows.map((m) => toPublicUser(m.user)) : null,
    modActionCount: isHost ? await db.roomModLog.count({ where: { roomId: room.id } }) : null,
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
    attended,
  };
}

/** Rooms you attended or hosted that have ended, newest first, with the same summary numbers. */
export async function pastRooms(me: User): Promise<RoomSummaryDto[]> {
  const rows = await getDb().room.findMany({
    where: {
      status: "ENDED",
      OR: [{ hostId: me.id }, { members: { some: { userId: me.id, joinedAt: { not: null } } } }],
    },
    orderBy: { endedAt: "desc" },
    take: 50,
    select: { slug: true },
  });
  const out: RoomSummaryDto[] = [];
  for (const r of rows) out.push(await roomSummary(me, r.slug));
  return out;
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

/** Chat of rooms that ended before chat was deleted on end. Run by the daily sweep, then it finds nothing. */
export async function purgeEndedRoomChat(): Promise<number> {
  const done = await getDb().roomMessage.deleteMany({ where: { room: { status: "ENDED" } } });
  return done.count;
}
