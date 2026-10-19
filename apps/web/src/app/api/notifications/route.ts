import { getDb } from "@gistroom/db";
import { LIMITS, type NotificationDto, type Page } from "@gistroom/shared";
import { decodeCursor, encodeCursor } from "@/server/cursor";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { toNotificationDto } from "@/server/notifications/service";
import { publish } from "@/server/realtime";

export const dynamic = "force-dynamic";

interface Cursor {
  t: string;
  id: string;
}
const isCursor = (v: unknown): v is Cursor =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Cursor).t === "string" &&
  typeof (v as Cursor).id === "string";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  const params = new URL(request.url).searchParams;
  const unreadOnly = params.get("unread") === "1";
  // Activity is the person's own receipts. It never mixes into All or Unread.
  const activity = params.get("tab") === "activity";
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || LIMITS.PAGE_SIZE_DEFAULT));
  const after = decodeCursor(params.get("cursor"), isCursor);
  const afterDate = after ? new Date(after.t) : null;

  const rows = await getDb().notification.findMany({
    where: {
      userId: user.id,
      ...(activity
        ? { type: "ACTIVITY", expiresAt: { gt: new Date() } }
        : { type: { not: "ACTIVITY" } }),
      ...(unreadOnly ? { readAt: null } : {}),
      ...(after && afterDate
        ? {
            OR: [{ createdAt: { lt: afterDate } }, { createdAt: afterDate, id: { lt: after.id } }],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const page: Page<NotificationDto> = {
    items: items.map(toNotificationDto),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id })
        : null,
  };
  return json(page);
});

/** Clear all of them (Section 9.7), or just the ones with ?ids=a,b,c. Activity is cleared with ?tab=activity. */
export const DELETE = api(async (request) => {
  const { user } = await requireOnboarded();
  const params = new URL(request.url).searchParams;
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 100);
  const activity = params.get("tab") === "activity";
  await getDb().notification.deleteMany({
    where: {
      userId: user.id,
      ...(ids.length ? { id: { in: ids } } : {}),
      ...(!ids.length ? (activity ? { type: "ACTIVITY" } : { type: { not: "ACTIVITY" } }) : {}),
    },
  });
  void publish({ type: "badge", userId: user.id });
  return json({ ok: true });
});
