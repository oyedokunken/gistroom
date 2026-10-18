import { getDb, toPublicUser, type Prisma, type User } from "@gistroom/db";
import {
  canActOn,
  canDo,
  errors,
  liveKitIdentity,
  topicBySlug,
  type ModActionInput,
  type RoomDto,
  type RoomModLogDto,
  type RoomRole,
  type RoomSettingsInput,
  isReactionEmoji,
} from "@gistroom/shared";
import { AppError, forbidden } from "../http";
import { muteInLiveKit, removeFromLiveKit } from "../livekit";
import { notify } from "../notifications/service";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { notifyRescheduled } from "./registration";
import {
  actorRole,
  applyPublishRules,
  denied,
  hideMessagesOf,
  loadBySlug,
  log,
  memberOf,
  toDto,
} from "./core";

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
      await hideMessagesOf(room.id, target.userId, me.id);
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
      await hideMessagesOf(room.id, target.userId, me.id);
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
  let moved = false;
  if (input.scheduledFor !== undefined) {
    // Only the host moves a room, and only before it starts.
    if (room.status !== "SCHEDULED" || role !== "HOST") throw forbidden(errors.roomNotAllowed);
    const next = new Date(input.scheduledFor);
    const now = Date.now();
    if (next.getTime() <= now + 60_000 || next.getTime() > now + 30 * 86_400_000) {
      throw new AppError(400, "INVALID", errors.roomScheduleBad, {
        fields: { scheduledFor: errors.roomScheduleBad },
      });
    }
    if (next.getTime() !== room.scheduledFor?.getTime()) {
      data.scheduledFor = next;
      moved = true;
    }
  }
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
  if (moved) void notifyRescheduled(updated);
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
