import { avatarUrl, getDb, type User } from "@gistroom/db";
import { errors } from "@gistroom/shared";
import { AppError } from "../http";
import { enforce, policies } from "../rate-limit";
import { checkCode, sendCode } from "../auth/otp-service";
import { verifyPassword } from "../auth/password";
import { logger } from "../logger";
import { sendTemplate } from "../mail/send";
import { buckets, removeObjects } from "../storage";

const FIELD = "password";

async function requirePassword(user: User, password: string | undefined): Promise<void> {
  if (!user.passwordHash) return;
  if (!password || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(400, "INVALID", errors.deleteWrongPassword, {
      fields: { [FIELD]: errors.deleteWrongPassword },
    });
  }
}

// ---------- Export ----------

/** Everything this person put into Gistroom, as one document. Other people's messages are never in it. */
export async function buildExport(user: User) {
  await enforce(policies.dataExport, user.id);
  const db = getDb();
  const [interests, friendships, blocks, sent, notes, calls, hosted, attended, sessions, prefs] =
    await Promise.all([
      db.userInterest.findMany({ where: { userId: user.id }, select: { topicSlug: true } }),
      db.friendship.findMany({
        where: { OR: [{ userLowId: user.id }, { userHighId: user.id }] },
        select: { userLowId: true, userHighId: true, createdAt: true },
      }),
      db.block.findMany({
        where: { blockerId: user.id },
        select: { blockedId: true, createdAt: true },
      }),
      db.message.findMany({
        where: { senderId: user.id, deletedForEveryoneAt: null },
        select: { type: true, body: true, createdAt: true, editedAt: true, conversationId: true },
        orderBy: { createdAt: "asc" },
        take: 20_000,
      }),
      db.note.findMany({
        where: { userId: user.id },
        select: {
          body: true,
          createdAt: true,
          conversationId: true,
          room: { select: { title: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.callLogEntry.findMany({
        where: { userId: user.id },
        select: {
          kind: true,
          direction: true,
          outcome: true,
          mediaType: true,
          titleSnapshot: true,
          startedAt: true,
          durationSec: true,
        },
        orderBy: { startedAt: "asc" },
      }),
      db.room.findMany({
        where: { hostId: user.id },
        select: { title: true, visibility: true, status: true, startedAt: true, endedAt: true },
      }),
      db.roomMember.findMany({
        where: { userId: user.id, state: { in: ["JOINED", "LEFT"] } },
        select: { role: true, joinedAt: true, leftAt: true, room: { select: { title: true } } },
      }),
      db.session.findMany({
        where: { userId: user.id },
        select: { deviceLabel: true, createdAt: true, lastSeenAt: true, revokedAt: true },
      }),
      db.notificationPreference.findUnique({ where: { userId: user.id } }),
    ]);

  const friendIds = friendships.map((f) => (f.userLowId === user.id ? f.userHighId : f.userLowId));
  const people = await db.user.findMany({
    where: { id: { in: [...friendIds, ...blocks.map((b) => b.blockedId)] } },
    select: { id: true, name: true, username: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const who = (id: string) => {
    const p = byId.get(id);
    return p ? { name: p.name, username: p.username } : null;
  };

  return {
    exportedAt: new Date().toISOString(),
    note: "This is a copy of the data you gave Gistroom. It does not include other people's messages.",
    profile: {
      name: user.name,
      username: user.username,
      email: user.email,
      bio: user.bio,
      avatar: avatarUrl(user.avatarPath),
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
      privacy: {
        discoverable: user.discoverable,
        showPresence: user.showPresence,
        sendReadReceipts: user.sendReadReceipts,
        roomInvitesFrom: user.roomInvitesFrom,
        dataSaver: user.dataSaver,
      },
    },
    interests: interests.map((i) => i.topicSlug),
    friends: friendships.map((f) => ({
      ...who(f.userLowId === user.id ? f.userHighId : f.userLowId),
      since: f.createdAt.toISOString(),
    })),
    blocked: blocks.map((b) => ({ ...who(b.blockedId), since: b.createdAt.toISOString() })),
    messagesYouSent: sent.map((m) => ({
      conversationId: m.conversationId,
      type: m.type,
      body: m.body,
      sentAt: m.createdAt.toISOString(),
      editedAt: m.editedAt?.toISOString() ?? null,
    })),
    notes: notes.map((n) => ({
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      where: n.room ? { room: n.room.title } : { conversationId: n.conversationId },
    })),
    calls: calls.map((c) => ({ ...c, startedAt: c.startedAt.toISOString() })),
    roomsYouHosted: hosted.map((r) => ({
      ...r,
      startedAt: r.startedAt?.toISOString() ?? null,
      endedAt: r.endedAt?.toISOString() ?? null,
    })),
    roomsYouAttended: attended.map((a) => ({
      title: a.room.title,
      role: a.role,
      joinedAt: a.joinedAt?.toISOString() ?? null,
      leftAt: a.leftAt?.toISOString() ?? null,
    })),
    devices: sessions.map((s) => ({
      device: s.deviceLabel,
      signedInAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      signedOut: s.revokedAt !== null,
    })),
    notificationPreferences: prefs
      ? {
          switches: prefs.switches,
          previews: prefs.previews,
          quietStart: prefs.quietStart,
          quietEnd: prefs.quietEnd,
        }
      : null,
  };
}

// ---------- Deletion ----------

export async function startAccountDeletion(
  user: User,
  ip: string,
): Promise<{ resendAfterSec: number }> {
  await enforce(policies.accountDelete, user.id);
  return sendCode({
    email: user.email,
    ip,
    purpose: "DELETE_ACCOUNT",
    template: "delete-account-otp",
  });
}

/**
 * Decision D5. The code (and the password, when there is one) confirm it. The account is marked deleted, its files
 * are removed, and in other people's chats the person shows as Deleted user. Reports are kept.
 */
export async function confirmAccountDeletion(
  user: User,
  input: { code: string; password?: string },
  ip: string,
): Promise<void> {
  await enforce(policies.accountDelete, user.id);
  await requirePassword(user, input.password);
  await checkCode({ email: user.email, code: input.code, ip, purpose: "DELETE_ACCOUNT" });

  const db = getDb();
  const oldEmail = user.email;
  const files = await db.fileAsset.findMany({
    where: { ownerId: user.id },
    select: { bucket: true, path: true },
  });
  const attachments = await db.messageAttachment.findMany({
    where: { message: { senderId: user.id } },
    select: { storagePath: true, thumbPath: true, messageId: true },
  });
  const messageIds = [...new Set(attachments.map((a) => a.messageId))];
  const now = new Date();
  const tail = user.id.toLowerCase();

  logger.info({ reason: "ACCOUNT_DELETED", userId: user.id }, "sessions ended");
  await db.$transaction([
    db.session.deleteMany({ where: { userId: user.id } }),
    db.pushSubscription.deleteMany({ where: { userId: user.id } }),
    db.notification.deleteMany({ where: { userId: user.id } }),
    db.notificationPreference.deleteMany({ where: { userId: user.id } }),
    db.userInterest.deleteMany({ where: { userId: user.id } }),
    db.note.deleteMany({ where: { userId: user.id } }),
    db.callLogEntry.deleteMany({ where: { userId: user.id } }),
    db.messageStar.deleteMany({ where: { userId: user.id } }),
    db.messageReaction.deleteMany({ where: { userId: user.id } }),
    db.messageHidden.deleteMany({ where: { userId: user.id } }),
    db.friendRequest.deleteMany({
      where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    }),
    db.friendship.deleteMany({
      where: { OR: [{ userLowId: user.id }, { userHighId: user.id }] },
    }),
    db.block.deleteMany({ where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] } }),
    // Photos, voice notes and files go. The messages stay as "This message was deleted".
    db.messageAttachment.deleteMany({ where: { message: { senderId: user.id } } }),
    db.message.updateMany({
      where: { id: { in: messageIds } },
      data: { deletedForEveryoneAt: now },
    }),
    db.fileAsset.deleteMany({ where: { ownerId: user.id } }),
    db.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED",
        deletedAt: now,
        name: "Deleted user",
        username: "deleted_" + tail.slice(-10),
        email: "deleted_" + tail + "@deleted.gistroom.invalid",
        bio: null,
        avatarPath: null,
        avatarKey: null,
        passwordHash: null,
        discoverable: false,
      },
    }),
  ]);

  try {
    const mediaPaths = [
      ...attachments.flatMap((a) => [a.storagePath, ...(a.thumbPath ? [a.thumbPath] : [])]),
      ...files.filter((f) => f.bucket === buckets.media()).map((f) => f.path),
    ];
    if (mediaPaths.length > 0) await removeObjects(buckets.media(), mediaPaths);
    const avatarPaths = [
      ...(user.avatarPath ? [user.avatarPath] : []),
      ...files.filter((f) => f.bucket === buckets.avatars()).map((f) => f.path),
    ];
    if (avatarPaths.length > 0) await removeObjects(buckets.avatars(), avatarPaths);
  } catch (error) {
    // The rows are already gone. The daily sweep and the owner can clear stray objects.
    logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "storage cleanup after deletion failed",
    );
  }
  await sendTemplate("account-deleted", oldEmail, {}).catch(() => undefined);
}
