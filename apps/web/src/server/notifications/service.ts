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
    // A one time notice the person already deleted must not come back when a sweep runs again.
    if (input.dedupeKey && !input.aggregate) {
      const sent = await db.notificationDelivery.findFirst({
        where: { userId: input.userId, stage: "CREATED", dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      if (sent) return null;
    }
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
  await db.notificationDelivery
    .create({
      data: {
        notificationId: row.id,
        userId: row.userId,
        stage: "CREATED",
        detail: row.type,
        dedupeKey: input.dedupeKey ?? null,
      },
    })
    .catch(() => null);
  void publish({ type: "notify", notificationId: row.id });
  return row;
}

/** Types that merge into one unread row. Reading one frees its key so the next event starts a fresh row. */
const AGGREGATED_TYPES = ["DM_MESSAGE", "ROOM_REGISTRATIONS"];

/**
 * Mark rows read. Only aggregated rows give up their dedupe key. A one time notice (a room reminder, a live now notice)
 * keeps it, otherwise reading the notice would let the next sweep send the same reminder a second time.
 */
export async function markRead(userId: string, ids: string[] | "all"): Promise<number> {
  const where = { userId, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) };
  const now = new Date();
  const aggregated = await getDb().notification.updateMany({
    where: { ...where, type: { in: AGGREGATED_TYPES } },
    data: { readAt: now, dedupeKey: null },
  });
  const rest = await getDb().notification.updateMany({ where, data: { readAt: now } });
  const count = aggregated.count + rest.count;
  if (count > 0) void publish({ type: "badge", userId });
  return count;
}
