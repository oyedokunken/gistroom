import { randomBytes, randomUUID } from "node:crypto";
import { getDb, type Room, type User } from "@gistroom/db";
import {
  LIMITS,
  canDo,
  errors,
  slugFromBytes,
  topicBySlug,
  type CreateRoomInput,
  type RoomDto,
  type RoomRole,
} from "@gistroom/shared";
import { AppError, forbidden, notFound } from "../http";
import { isBlockedEitherWay } from "../friends/relations";
import { closeLiveKitRoom } from "../livekit";
import { notify } from "../notifications/service";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { recordActivity } from "../notifications/activity";
import {
  clearRoomJobs,
  ensureRoomJobs,
  notifyCancelled,
  notifyLive,
  onRegistered,
  onUnregistered,
} from "./registration";
import { emailRoomEnded } from "../mail/notify-email";
import { isUniqueViolation } from "../db-errors";
import { denied, linkReason, linkValid, loadBySlug, log, memberOf, toDto } from "./core";

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
      if (scheduledFor) await ensureRoomJobs(room);
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
  // The people who registered hear it now, if they are not already inside. Never at the scheduled time alone.
  void notifyLive(updated);
  void clearRoomJobs(room.id);
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
    // Registering is for a room that has not started. Once it is live the person just joins.
    if (room.status === "SCHEDULED" && (!member || member.state === "INVITED")) {
      // A second tap changes nothing: no second notice, no second email.
      if (!member?.registeredAt) {
        const now = new Date();
        if (member) {
          await db.roomMember.update({ where: { id: member.id }, data: { registeredAt: now } });
        } else {
          await db.roomMember.create({
            data: {
              roomId: room.id,
              userId: me.id,
              role: "MEMBER",
              state: "INVITED",
              registeredAt: now,
            },
          });
        }
        void onRegistered(room, me);
      }
    } else if (!member) {
      await db.roomMember.create({
        data: { roomId: room.id, userId: me.id, role: "MEMBER", state: "INVITED" },
      });
    }
  } else if (member?.state === "INVITED" && member.registeredAt) {
    // Someone who only put their own name down leaves the list. Someone who was invited stays invited.
    if (room.visibility === "PUBLIC" && member.invitedById === null) {
      await db.roomMember.delete({ where: { id: member.id } });
    } else {
      await db.roomMember.update({ where: { id: member.id }, data: { registeredAt: null } });
    }
    void onUnregistered(room, me.id);
  }
  const now = await memberOf(room.id, me.id);
  return toDto(room, now?.role ?? null, Boolean(now?.registeredAt));
}

// ---------- Viewing ----------

export type RoomView =
  | { state: "OK"; room: RoomDto }
  | { state: "NOT_INVITED" }
  | { state: "LINK_INVALID"; reason?: "REVOKED" | "EXPIRED" | "USED_UP" | "UNKNOWN" }
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
  if (linkToken && !linkOk && !isHost && !inRoom) {
    return { state: "LINK_INVALID", reason: await linkReason(room.id, linkToken) };
  }
  if (room.visibility === "PRIVATE" && !isHost && !inRoom && !linkOk) {
    return { state: "NOT_INVITED" };
  }
  if (room.status === "ENDED") return { state: "ENDED" };
  const going = !isHost && Boolean(member?.registeredAt);
  const now = new Date();
  const holdsSeat =
    room.status === "LIVE" &&
    (member?.state === "JOINED" ||
      (member?.state === "LEFT" && member.graceUntil !== null && member.graceUntil > now));
  return {
    state: "OK",
    room: await toDto(room, isHost ? "HOST" : (member?.role ?? null), going, Boolean(holdsSeat)),
  };
}

export async function finishRoom(room: Room, actorId: string | null): Promise<void> {
  const db = getDb();
  const now = new Date();
  const claimed = await db.room.updateMany({
    where: { id: room.id, status: { not: "ENDED" } },
    data: { status: "ENDED", endedAt: now },
  });
  if (claimed.count === 0) return;
  if (room.status === "SCHEDULED") {
    // It never started, so nobody was in it. The people on its list are told it was cancelled.
    const full = await db.room.findUniqueOrThrow({
      where: { id: room.id },
      include: { host: true, topic: { select: { slug: true, name: true } } },
    });
    if (actorId) await log(room.id, actorId, "END");
    await notifyCancelled(full, "HOST_CANCELLED");
    return;
  }
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
