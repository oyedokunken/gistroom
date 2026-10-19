import { getDb, toPublicUser, type Prisma, type Room, type User } from "@gistroom/db";
import {
  LIMITS,
  canDo,
  joinVerdict,
  linkState,
  liveKitIdentity,
  nextHost,
  roomRingId,
  type RoomJoin,
  type RoomMemberDto,
} from "@gistroom/shared";
import { notFound } from "../http";
import { isBlockedEitherWay } from "../friends/relations";
import { mintJoin } from "../livekit";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import {
  actorRole,
  denied,
  hash,
  joinedCount,
  loadBySlug,
  log,
  memberOf,
  publishSources,
  toDto,
} from "./core";

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
      ? {
          state: member.state,
          role: member.role,
          graceUntil: member.graceUntil,
          leftAt: member.leftAt,
        }
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
    // Two people opening a one use link at once: only one claim can succeed, the database decides.
    const claimed = await db.roomInviteLink.updateMany({
      where: {
        id: link.id,
        revokedAt: null,
        expiresAt: { gt: now },
        ...(link.maxUses !== null ? { usedCount: { lt: link.maxUses } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (claimed.count === 0) throw denied("NOT_INVITED");
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
      heartbeatAt: now,
      invitedById: link?.createdById ?? null,
    },
    update: {
      state: "JOINED",
      role: verdict.role,
      leftAt: null,
      graceUntil: null,
      heartbeatAt: now,
      ringStatus: null,
      ...(wasIn
        ? {}
        : { joinedAt: member?.joinedAt && member.state === "LEFT" ? member.joinedAt : now }),
    },
  });
  // Joining answers a ring: the card closes on this person's other devices.
  if (member?.ringStatus === "RINGING" && member.ringedAt) {
    void publish({
      type: "ring",
      userId: me.id,
      ringId: roomRingId(room.slug, member.ringedAt),
      roomSlug: room.slug,
      change: "joined",
    });
  }
  // Two people taking the last seat together both pass the check above. The database has the final say: the seats
  // are counted in the order people came in, and whoever is past the limit steps back out.
  if (!isHost && !wasIn) {
    const seated = await db.roomMember.findMany({
      where: { roomId: room.id, state: "JOINED" },
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      select: { userId: true },
    });
    const place = seated.findIndex((s) => s.userId === me.id);
    if (place >= room.maxParticipants) {
      await db.roomMember.update({
        where: { roomId_userId: { roomId: room.id, userId: me.id } },
        data: member
          ? { state: member.state, leftAt: member.leftAt, graceUntil: member.graceUntil }
          : { state: "LEFT", leftAt: now, graceUntil: null },
      });
      throw denied("FULL");
    }
  }
  void publish({ type: "room", roomId: room.id, change: "member", userId: me.id });

  const present = await joinedCount(room.id);
  if (present > room.peakParticipants) {
    await db.room.update({ where: { id: room.id }, data: { peakParticipants: present } });
  }
  const { token, url } = mintJoin({
    identity: liveKitIdentity(me.id),
    name: me.name,
    room: room.livekitRoom,
    // Covers the longest a room can run, so a reconnect late in a long room still has a valid token.
    ttlSec: (LIMITS.ROOM_MAX_DURATION_HOURS + 1) * 3600,
    canPublishSources: publishSources(room, verdict.role),
  });
  return { room: await toDto(room, verdict.role), token, url, role: verdict.role };
}

/** Leaving keeps your seat for 120 seconds. If the host leaves, the room passes to someone else. */
export async function leaveRoom(
  me: User,
  slug: string,
  opts: { dropped?: boolean } = {},
): Promise<void> {
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

  // A host who dropped keeps the room for the grace period. Everyone sees "Host is reconnecting" until it passes.
  if (room.hostId === me.id && room.status === "LIVE" && !opts.dropped) {
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

export async function listMembers(me: User, slug: string): Promise<RoomMemberDto[]> {
  const room = await loadBySlug(slug);
  if (!(await actorRole(room, me.id))) throw notFound();
  // People who can invite also see who was invited and has not come in, with how the ring went.
  const role = await actorRole(room, me.id);
  const seesInvited = canDo(role, "INVITE");
  const rows = await getDb().roomMember.findMany({
    where: { roomId: room.id, state: seesInvited ? { in: ["JOINED", "INVITED"] } : "JOINED" },
    include: { user: true },
    orderBy: [{ joinedAt: "asc" }, { createdAt: "asc" }],
  });
  return rows
    .filter((m) => m.userId !== room.hostId || m.state === "JOINED")
    .map((m) => ({
      user: toPublicUser(m.user),
      role: m.role,
      state: m.state,
      joinedAt: m.joinedAt?.toISOString() ?? null,
      ringStatus:
        m.state === "INVITED" &&
        (m.ringStatus === "RINGING" || m.ringStatus === "DECLINED" || m.ringStatus === "NO_ANSWER")
          ? m.ringStatus
          : null,
    }));
}

// ---------- Staying in touch: heartbeats, reconciling, rings ----------

/** "Still here" from a tab inside the room. Silent for 20 seconds counts as left. */
export async function heartbeatRoom(me: User, slug: string): Promise<void> {
  await enforce(policies.roomHeartbeat, me.id);
  const room = await loadBySlug(slug);
  const member = await memberOf(room.id, me.id);
  if (!member || room.status !== "LIVE") return;
  // A person whose seat the sweep gave up on a moment ago comes back by joining again, not by this ping.
  if (member.state !== "JOINED") return;
  await getDb().roomMember.update({ where: { id: member.id }, data: { heartbeatAt: new Date() } });
}

export async function handOverHost(room: Room, leavingId: string): Promise<void> {
  const db = getDb();
  const present = await db.roomMember.findMany({ where: { roomId: room.id, state: "JOINED" } });
  const heir = nextHost(
    present.map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.joinedAt })),
    leavingId,
  );
  if (!heir) return;
  await db.$transaction([
    db.room.update({ where: { id: room.id }, data: { hostId: heir } }),
    db.roomMember.updateMany({ where: { roomId: room.id, userId: heir }, data: { role: "HOST" } }),
    db.roomMember.updateMany({
      where: { roomId: room.id, userId: leavingId },
      data: { role: "MEMBER" },
    }),
  ]);
  await log(room.id, leavingId, "PROMOTE", heir, { transfer: true, automatic: true });
  void publish({ type: "room", roomId: room.id, change: "member", userId: heir });
}
