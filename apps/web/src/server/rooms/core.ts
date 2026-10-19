import { createHash } from "node:crypto";
import {
  getDb,
  toPublicUser,
  type Prisma,
  type Room,
  type RoomMember,
  type User,
} from "@gistroom/db";
import {
  canDo,
  errors,
  linkState,
  liveKitIdentity,
  type JoinDenied,
  type RoomDto,
  type RoomRole,
} from "@gistroom/shared";
import { AppError, notFound } from "../http";
import { setPublishSources, type PublishSource } from "../livekit";
import { publish } from "../realtime";

type RoomRow = Room & { host: User; topic: { slug: string; name: string } | null };

export const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const DENIED: Record<JoinDenied, { status: number; message: string }> = {
  ENDED: { status: 410, message: errors.roomEnded },
  NOT_STARTED: { status: 409, message: errors.roomNotStarted },
  NOT_INVITED: { status: 403, message: errors.roomNotInvited },
  BANNED: { status: 403, message: errors.roomBanned },
  REMOVED: { status: 403, message: errors.roomRemoved },
  FULL: { status: 409, message: errors.roomFull },
  LOCKED: { status: 409, message: errors.roomLocked },
};

export function denied(reason: JoinDenied): AppError {
  const d = DENIED[reason];
  return new AppError(d.status, d.status === 403 ? "FORBIDDEN" : "CONFLICT", d.message);
}

export async function loadBySlug(slug: string): Promise<RoomRow> {
  const room = await getDb().room.findUnique({
    where: { slug },
    include: { host: true, topic: { select: { slug: true, name: true } } },
  });
  if (!room) throw notFound();
  return room;
}

export async function joinedCount(roomId: string): Promise<number> {
  return getDb().roomMember.count({ where: { roomId, state: "JOINED" } });
}

export async function memberOf(roomId: string, userId: string): Promise<RoomMember | null> {
  return getDb().roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
}

export async function log(
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

export async function toDto(
  room: RoomRow,
  viewerRole: RoomRole | null,
  going = false,
  rejoin = false,
): Promise<RoomDto> {
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
    rejoin,
  };
}

/**
 * What a person may publish. Moderators and the host always may everything. Members lose the microphone while
 * "only moderators can unmute" is on, and the camera while cameras are not allowed.
 */
export function publishSources(room: Room, role: RoomRole): PublishSource[] {
  const all: PublishSource[] = ["microphone", "camera", "screen_share"];
  if (role !== "MEMBER") return all;
  return all.filter((s) => {
    if (s === "microphone") return !room.unmuteLocked;
    if (s === "camera") return room.cameraAllowed;
    return true;
  });
}

/** Push the current rules to everyone inside, so a settings change works at once. */
export async function applyPublishRules(room: Room): Promise<void> {
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

/** Why a link no longer works, so the person is told "turned off" or "expired" and not left guessing. */
export async function linkReason(
  roomId: string,
  token: string,
): Promise<"REVOKED" | "EXPIRED" | "USED_UP" | "UNKNOWN"> {
  const link = await getDb().roomInviteLink.findUnique({ where: { tokenHash: hash(token) } });
  if (!link || link.roomId !== roomId) return "UNKNOWN";
  const state = linkState({ ...link, now: new Date() });
  return state === "OK" ? "UNKNOWN" : state;
}

export async function linkValid(roomId: string, token: string): Promise<boolean> {
  const link = await getDb().roomInviteLink.findUnique({ where: { tokenHash: hash(token) } });
  if (!link || link.roomId !== roomId) return false;
  return linkState({ ...link, now: new Date() }) === "OK";
}

// ---------- People and moderation ----------

export async function roleIn(room: Room, userId: string): Promise<RoomRole> {
  if (room.hostId === userId) return "HOST";
  return (await memberOf(room.id, userId))?.role ?? "MEMBER";
}

export async function actorRole(room: Room, userId: string): Promise<RoomRole | null> {
  if (room.hostId === userId) return "HOST";
  const m = await memberOf(room.id, userId);
  return m && m.state === "JOINED" ? m.role : null;
}

/** A person who was removed or banned has their room chat taken off the screen for everyone. */
export async function hideMessagesOf(
  roomId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  const db = getDb();
  const done = await db.roomMessage.updateMany({
    where: { roomId, senderId: userId, deletedAt: null },
    data: { deletedAt: new Date(), deletedById: actorId, body: "" },
  });
  if (done.count > 0) void publish({ type: "room", roomId, change: "chat-deleted", messageId: "" });
}

/** Private rooms: host and moderators only. Public rooms: any member, unless the host turned sharing off. */
export function canShareLink(room: Room, role: RoomRole | null): boolean {
  if (canDo(role, "LINK")) return true;
  return room.visibility === "PUBLIC" && room.membersCanShare && role !== null;
}

export async function factsOf(room: Room) {
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

export const appBase = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
