import { getDb, type Notification, type Prisma } from "@gistroom/db";
import {
  channelsFor,
  defaultPrefs,
  notificationPrefsSchema,
  type NotificationType,
} from "@gistroom/shared";
import { publish } from "../realtime";

export { toNotificationDto } from "@gistroom/db";

export async function loadPrefs(userId: string) {
  const row = await getDb().notificationPreference.findUnique({ where: { userId } });
  if (!row) return defaultPrefs;
  const parsed = notificationPrefsSchema.safeParse({
    switches: row.switches,
    previews: row.previews,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  });
  return parsed.success ? parsed.data : defaultPrefs;
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  /** One time events carry a key so a repeat is ignored (Section 7). */
  dedupeKey?: string;
  /** For aggregated rows such as DMs: merge into the unread row instead of adding another. */
  aggregate?: (existing: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Record a notification and ask realtime to deliver it. The row and a ScheduledJob are written first,
 * so a sleeping or restarting realtime service still delivers it from the 30 second poll (Decisions D29).
 */
export async function notify(input: NotifyInput): Promise<Notification | null> {
  const db = getDb();
  const [user, prefs] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { timezone: true, status: true } }),
    loadPrefs(input.userId),
  ]);
  if (!user || user.status !== "ACTIVE") return null;
  const channels = channelsFor({
    type: input.type,
    prefs,
    timeZone: user.timezone,
    now: new Date(),
  });
  if (!channels.inApp) return null;

  let row: Notification;
  const existing = input.dedupeKey
    ? await db.notification.findUnique({
        where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
      })
    : null;

  if (existing) {
    if (!input.aggregate || existing.readAt) return null;
    row = await db.notification.update({
      where: { id: existing.id },
      data: {
        payload: input.aggregate(
          (existing.payload as Record<string, unknown>) ?? {},
        ) as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    });
  } else {
    row = await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  }

  await db.scheduledJob.create({
    data: { kind: "notify", dueAt: new Date(), payload: { notificationId: row.id } },
  });
  void publish({ type: "notify", notificationId: row.id });
  return row;
}

/** Mark rows read. Clearing the dedupe key lets the next aggregated event start a fresh row. */
export async function markRead(userId: string, ids: string[] | "all"): Promise<number> {
  const r = await getDb().notification.updateMany({
    where: { userId, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
    data: { readAt: new Date(), dedupeKey: null },
  });
  if (r.count > 0) void publish({ type: "badge", userId });
  return r.count;
}
