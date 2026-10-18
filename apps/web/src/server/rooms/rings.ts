import { getDb, type User } from "@gistroom/db";
import { LIMITS, canDo, errors, inQuietHours, roomRingId } from "@gistroom/shared";
import { AppError, forbidden } from "../http";
import { areFriends, isBlockedEitherWay } from "../friends/relations";
import { notify } from "../notifications/service";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { actorRole, denied, loadBySlug, log, memberOf } from "./core";

/**
 * Ring someone who is invited and not inside yet. It is a call style alert: an in-app ring and a high urgency push.
 * One ring per person every 30 seconds, three per room every 10 minutes. Quiet hours and Do Not Disturb are respected
 * (the in-app list still gets it) and the ringer is told it may not be seen right away.
 */
export async function ringMember(
  me: User,
  slug: string,
  userId: string,
): Promise<{ status: "RINGING"; mayNotSee: boolean }> {
  const db = getDb();
  const room = await loadBySlug(slug);
  const role = await actorRole(room, me.id);
  if (!canDo(role, "INVITE")) throw forbidden(errors.roomNotAllowed);
  if (room.status !== "LIVE") throw denied(room.status === "ENDED" ? "ENDED" : "NOT_STARTED");
  if (userId === me.id) throw forbidden(errors.roomNotAllowed);
  if ((await isBlockedEitherWay(me.id, userId)) || !(await areFriends(me.id, userId))) {
    throw forbidden(errors.roomNotAllowed);
  }
  const member = await memberOf(room.id, userId);
  if (member?.state === "BANNED" || member?.state === "REMOVED") throw denied("BANNED");
  if (member?.state === "JOINED") throw new AppError(409, "CONFLICT", errors.roomRingNotInside);
  if (!member && room.visibility === "PRIVATE") {
    // A private room only rings people already on its list, so ringing never leaks it.
    throw forbidden(errors.roomNotAllowed);
  }
  if (member?.noRing) throw new AppError(409, "CONFLICT", errors.roomRingOff);
  await enforce(policies.roomRingPerson, `${room.id}:${userId}`);
  await enforce(policies.roomRingRoom, room.id);

  const now = new Date();
  await db.roomMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: {
      roomId: room.id,
      userId,
      state: "INVITED",
      invitedById: me.id,
      ringStatus: "RINGING",
      ringedAt: now,
    },
    update: { ringStatus: "RINGING", ringedAt: now },
  });
  const prefs = await db.notificationPreference.findUnique({ where: { userId } });
  const target = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const quiet = inQuietHours(
    now,
    target?.timezone ?? "Africa/Lagos",
    prefs?.quietStart ?? null,
    prefs?.quietEnd ?? null,
  );
  await notify({
    userId,
    type: "ROOM_INVITE",
    payload: {
      ring: true,
      roomId: room.id,
      roomSlug: room.slug,
      roomTitle: room.title,
      fromName: me.name,
    },
    dedupeKey: `room-ring:${room.id}:${now.getTime()}`,
  }).catch(() => null);
  await log(room.id, me.id, "INVITE", userId, { ring: true });
  void publish({ type: "room", roomId: room.id, change: "member", userId });
  void publish({
    type: "ring",
    userId,
    ringId: roomRingId(room.slug, now),
    roomSlug: room.slug,
    change: "ringing",
  });
  return { status: "RINGING", mayNotSee: quiet };
}

/** The ringed person turns it down, or asks not to be rung for this room again. */
export async function answerRing(
  me: User,
  slug: string,
  answer: { noRing?: boolean },
): Promise<void> {
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (!member) return;
  await getDb().roomMember.update({
    where: { id: member.id },
    data: { ringStatus: "DECLINED", ...(answer.noRing ? { noRing: true } : {}) },
  });
  void publish({ type: "room", roomId: room.id, change: "member", userId: me.id });
  // The card closes on this person's other devices too.
  if (member.ringedAt) {
    void publish({
      type: "ring",
      userId: me.id,
      ringId: roomRingId(room.slug, member.ringedAt),
      roomSlug: room.slug,
      change: "declined",
    });
  }
}

/** Rings that nobody answered in 45 seconds become No answer. */
export async function expireRings(now = new Date()): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - LIMITS.CALL_RING_TIMEOUT_SEC * 1000);
  const due = await db.roomMember.findMany({
    where: { ringStatus: "RINGING", ringedAt: { lt: cutoff } },
    select: {
      id: true,
      roomId: true,
      userId: true,
      ringedAt: true,
      room: { select: { slug: true } },
    },
    take: 200,
  });
  for (const m of due) {
    await db.roomMember.update({ where: { id: m.id }, data: { ringStatus: "NO_ANSWER" } });
    void publish({ type: "room", roomId: m.roomId, change: "member", userId: m.userId });
    if (m.ringedAt) {
      void publish({
        type: "ring",
        userId: m.userId,
        ringId: roomRingId(m.room.slug, m.ringedAt),
        roomSlug: m.room.slug,
        change: "expired",
      });
    }
  }
  return due.length;
}
