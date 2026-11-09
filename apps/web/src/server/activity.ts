import { getDb } from "@gistroom/db";
import { logger } from "./logger";

/**
 * Records that a person did something meaningful: sent a message, joined a room, made a call, answered a friend request.
 * It stores only when, never what. `User.lastActiveAt` moves at most once an hour and one `ActivityDay` row is written per
 * Lagos calendar day, so the cost is a handful of writes a day however busy the person is. These two facts feed the
 * re-engagement email and the Consistent Gist badge, and nothing else.
 */

const HOUR_MS = 3_600_000;
const recent = new Map<string, number>();
const RECENT_LIMIT = 5000;

/** The Lagos calendar day (UTC+1, no daylight saving) as a date at midnight UTC. */
export function lagosDay(now: Date): Date {
  const shifted = new Date(now.getTime() + HOUR_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export async function touchActivity(userId: string, now = new Date()): Promise<void> {
  // This process already wrote for this person in the last ten minutes. Nothing new to learn.
  const last = recent.get(userId);
  if (last !== undefined && now.getTime() - last < 10 * 60_000) return;
  if (recent.size > RECENT_LIMIT) recent.clear();
  recent.set(userId, now.getTime());
  try {
    const db = getDb();
    await db.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: new Date(now.getTime() - HOUR_MS) } }],
      },
      data: { lastActiveAt: now },
    });
    await db.activityDay.createMany({
      data: [{ userId, day: lagosDay(now) }],
      skipDuplicates: true,
    });
  } catch (error) {
    // Never let bookkeeping break the action that caused it.
    recent.delete(userId);
    logger.warn(
      { err: error instanceof Error ? error.message : String(error) },
      "activity write failed",
    );
  }
}
