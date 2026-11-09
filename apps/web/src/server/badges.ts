import { getDb, type Prisma } from "@gistroom/db";
import {
  BADGE_EVALUATOR_VERSION,
  PUBLIC_BADGE_LIMIT,
  badgeByKey,
  missingGrants,
  summarizeBadges,
  type BadgeChip,
  type BadgeStats,
} from "@gistroom/shared";
import { logger } from "./logger";
import { notify } from "./notifications/service";

/**
 * Badges are granted by the server from facts it holds. A grant is one row with a unique key (person, badge, ordinal), so
 * running the worker twice, or two servers at once, grants once. A row is never deleted: moderation revokes it with a
 * time, an actor and an audit entry. The visible summary is kept on the user row so it can be shown next to a name
 * without a query per person.
 */

const STAY_MS = 10 * 60_000;
const MIN_MESSAGES = 3;
const CAP = 500;

/** Counts the facts the rules read. Internal accounts never count as friends. */
export async function computeBadgeStats(userId: string): Promise<BadgeStats> {
  const db = getDb();

  const [hosted, attendedRows, friendRows, activeDays, resolved, chatGroups] = await Promise.all([
    db.room.findMany({
      where: {
        hostId: userId,
        status: "ENDED",
        startedAt: { not: null },
        peakParticipants: { gte: 2 },
      },
      select: { id: true, topicId: true },
      take: CAP,
    }),
    db.roomMember.findMany({
      where: {
        userId,
        joinedAt: { not: null },
        state: { in: ["JOINED", "LEFT"] },
        room: { status: "ENDED", startedAt: { not: null }, hostId: { not: userId } },
      },
      select: { joinedAt: true, leftAt: true, room: { select: { topicId: true } } },
      take: CAP,
    }),
    db.friendship.findMany({
      where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
      select: { userLowId: true, userHighId: true },
      take: CAP,
    }),
    db.activityDay.count({ where: { userId } }),
    db.report.count({
      where: { reporterId: userId, status: "RESOLVED", resolution: { not: null } },
    }),
    db.message.groupBy({
      by: ["conversationId"],
      where: { senderId: userId, type: { in: ["TEXT", "IMAGE", "VIDEO", "VOICE", "FILE"] } },
      _count: { _all: true },
      having: { id: { _count: { gte: MIN_MESSAGES } } },
    }),
  ]);

  const hostedIds = hosted.map((r) => r.id);
  const openReportsAgainst = await db.report.count({
    where: {
      status: { in: ["OPEN", "REVIEWING"] },
      OR: [
        { targetType: "USER", targetId: userId },
        ...(hostedIds.length > 0
          ? [{ targetType: "ROOM" as const, targetId: { in: hostedIds } }]
          : []),
      ],
    },
  });

  const stayed = attendedRows.filter(
    (m) => m.joinedAt && m.leftAt && m.leftAt.getTime() - m.joinedAt.getTime() >= STAY_MS,
  );

  // Friends who are active and not blocked either way. One query for the blocks of this person.
  const otherIds = friendRows.map((f) => (f.userLowId === userId ? f.userHighId : f.userLowId));
  const blocks =
    otherIds.length > 0
      ? await db.block.findMany({
          where: {
            OR: [
              { blockerId: userId, blockedId: { in: otherIds } },
              { blockedId: userId, blockerId: { in: otherIds } },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
      : [];
  const blocked = new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
  const others =
    otherIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: otherIds }, status: "ACTIVE", isInternal: false },
          select: { id: true },
        })
      : [];
  const friends = others.filter((o) => !blocked.has(o.id)).length;

  const topics = new Set<string>();
  for (const r of hosted) if (r.topicId) topics.add(r.topicId);
  for (const m of attendedRows) if (m.room.topicId) topics.add(m.room.topicId);

  return {
    completedRoomsHosted: hosted.length,
    openReportsAgainst,
    roomsAttended: attendedRows.length,
    meaningfulPlaces: chatGroups.length + stayed.length,
    roomsStayed: stayed.length,
    friends,
    distinctTopics: topics.size,
    activeDays,
    actionableReports: resolved,
  };
}

/**
 * Grants every badge the person has earned and does not hold yet, then refreshes the summary shown next to their name.
 * Safe to call at any time and from any number of places. Returns the badges newly granted.
 */
export async function grantBadges(userId: string): Promise<BadgeChip[]> {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return [];

  const stats = await computeBadgeStats(userId);
  const held = await db.badgeGrant.findMany({
    where: { userId },
    select: { badge: true, ordinal: true },
  });
  const missing = missingGrants(stats, held);

  const created: BadgeChip[] = [];
  if (missing.length > 0) {
    // The unique key decides a race: whoever inserts first owns the ordinal, the other insert is skipped.
    for (const g of missing) {
      const result = await db.badgeGrant.createMany({
        data: [
          {
            userId,
            badge: g.badge,
            ordinal: g.ordinal,
            evaluator: BADGE_EVALUATOR_VERSION,
            source: stats as unknown as Prisma.InputJsonValue,
          },
        ],
        skipDuplicates: true,
      });
      if (result.count === 1) {
        created.push({ badge: g.badge, count: g.ordinal });
        await db.auditLog.create({
          data: {
            actorId: null,
            action: "badge.grant",
            targetId: userId,
            meta: { badge: g.badge, ordinal: g.ordinal },
          },
        });
      }
    }
  }
  await refreshBadgeSummary(userId);

  for (const c of created) {
    const def = badgeByKey(c.badge);
    if (!def) continue;
    void notify({
      userId,
      type: "SYSTEM",
      payload: {
        title: `You earned a badge: ${def.name}${c.count > 1 ? ` (x${c.count})` : ""}`,
        body: def.summary,
        noPush: true,
      },
      dedupeKey: `badge:${c.badge}:${c.count}:${userId}`,
    }).catch(() => null);
  }
  return created;
}

/** Rewrites the public summary on the user row from the grants that are still active. Private badges stay out of it. */
export async function refreshBadgeSummary(userId: string): Promise<BadgeChip[]> {
  const db = getDb();
  const grants = await db.badgeGrant.findMany({
    where: { userId },
    select: { badge: true, revokedAt: true },
  });
  const chips = summarizeBadges(grants, { publicOnly: true, limit: PUBLIC_BADGE_LIMIT });
  await db.user.update({
    where: { id: userId },
    data: { badgesPublic: chips as unknown as Prisma.InputJsonValue },
  });
  return chips;
}

/** Every badge the person holds, for their own profile: private ones included, revoked ones not. */
export async function badgesFor(
  userId: string,
  opts: { includePrivate: boolean },
): Promise<BadgeChip[]> {
  const grants = await getDb().badgeGrant.findMany({
    where: { userId },
    select: { badge: true, revokedAt: true },
  });
  return summarizeBadges(grants, { publicOnly: !opts.includePrivate });
}

/**
 * Moderation revokes a grant. The row stays, with who revoked it and when, an audit entry is written, and the badge is
 * not granted again at the same ordinal.
 */
export async function revokeBadge(input: {
  actorId: string;
  userId: string;
  badge: string;
  reason: string;
}): Promise<number> {
  const db = getDb();
  const now = new Date();
  const result = await db.badgeGrant.updateMany({
    where: { userId: input.userId, badge: input.badge, revokedAt: null },
    data: { revokedAt: now, revokedById: input.actorId },
  });
  if (result.count > 0) {
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "badge.revoke",
        targetId: input.userId,
        meta: { badge: input.badge, count: result.count, reason: input.reason.slice(0, 200) },
      },
    });
    await refreshBadgeSummary(input.userId);
  }
  return result.count;
}

/** Runs the worker for several people, one after another, so a failure for one never stops the rest. */
export async function grantBadgesFor(userIds: readonly string[]): Promise<void> {
  for (const id of new Set(userIds)) {
    await grantBadges(id).catch((error) =>
      logger.warn(
        { err: error instanceof Error ? error.message : String(error) },
        "badge grant failed",
      ),
    );
  }
}

/** The daily safety net: people who were active in the last two days are checked, a batch at a time. */
export async function sweepBadges(limit = 200, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 2 * 86_400_000);
  const users = await getDb().user.findMany({
    where: { status: "ACTIVE", isInternal: false, lastActiveAt: { gte: since } },
    select: { id: true },
    orderBy: { lastActiveAt: "desc" },
    take: limit,
  });
  await grantBadgesFor(users.map((u) => u.id));
  return users.length;
}
