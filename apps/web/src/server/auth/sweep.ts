import { getDb } from "@gistroom/db";
import { LIMITS } from "@gistroom/shared";
import { logger } from "../logger";

const DAY = 86_400_000;

/**
 * Daily cleanup. A session is only removed once it expired more than 7 days ago, never because of when it was last
 * used, so a person who is simply away is not signed out by the sweep (Section 6.2). Sessions that ran out without
 * anyone noticing are first given the reason EXPIRED.
 */
export async function sweepSessions(now = new Date()): Promise<{ expired: number; swept: number }> {
  const db = getDb();
  const expired = await db.session.updateMany({
    where: { endedAt: null, expiresAt: { lte: now } },
    data: { endedAt: now, endReason: "EXPIRED" },
  });
  const cutoff = new Date(now.getTime() - LIMITS.SESSION_SWEEP_GRACE_DAYS * DAY);
  const swept = await db.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  if (swept.count > 0) {
    logger.info({ reason: "SWEPT", count: swept.count }, "sessions swept");
    await db.auditLog
      .create({ data: { action: "sessions.swept", meta: { count: swept.count } } })
      .catch(() => undefined);
  }
  return { expired: expired.count, swept: swept.count };
}

/** Subscriptions with no successful delivery for 90 days, and dead ones the push service already refused. */
export async function sweepSubscriptions(now = new Date()): Promise<number> {
  const stale = new Date(now.getTime() - LIMITS.PUSH_STALE_DAYS * DAY);
  const week = new Date(now.getTime() - 7 * DAY);
  const r = await getDb().pushSubscription.deleteMany({
    where: {
      OR: [
        { lastSuccessAt: { lt: stale } },
        { lastSuccessAt: null, createdAt: { lt: stale } },
        { revokedAt: { lt: week } },
      ],
    },
  });
  return r.count;
}
