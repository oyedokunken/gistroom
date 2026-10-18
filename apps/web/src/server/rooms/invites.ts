import { randomBytes, randomUUID } from "node:crypto";
import { getDb, type User } from "@gistroom/db";
import { LIMITS, canDo, errors, linkExpiry, linkState, type RoomLinkDto } from "@gistroom/shared";
import { AppError, forbidden } from "../http";
import { areFriends, isBlockedEitherWay } from "../friends/relations";
import { notify } from "../notifications/service";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { accessFor, assertCanInteract, sendMessage } from "../chat/service";
import { ensureConversation } from "../friends/service";
import { recordActivity } from "../notifications/activity";
import { emailRoomInvite } from "../mail/notify-email";
import {
  actorRole,
  appBase,
  canShareLink,
  denied,
  factsOf,
  hash,
  loadBySlug,
  log,
  memberOf,
} from "./core";

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
      // A person removed a moment ago stays out for the wait, so a forwarded link cannot undo it.
      const cooling =
        existing?.state === "REMOVED" &&
        existing.leftAt !== null &&
        Date.now() - existing.leftAt.getTime() < LIMITS.ROOM_REMOVE_COOLDOWN_MIN * 60_000;
      if (!cooling && (!existing || existing.state === "REMOVED")) {
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
