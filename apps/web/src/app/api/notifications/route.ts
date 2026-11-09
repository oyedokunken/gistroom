import { getDb } from "@gistroom/db";
import { notificationListQuerySchema, type NotificationDto, type Page } from "@gistroom/shared";
import { decodeCursor, encodeCursor } from "@/server/cursor";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { isListCursor, notificationWhere } from "@/server/notifications/list";
import { toNotificationDto } from "@/server/notifications/service";
import { publish } from "@/server/realtime";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = notificationListQuerySchema.parse(params);
  const after = decodeCursor(query.cursor, isListCursor);
  const rows = await getDb().notification.findMany({
    where: notificationWhere(user.id, query, after, new Date()),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
  });
  const items = rows.slice(0, query.limit);
  const last = items[items.length - 1];
  const page: Page<NotificationDto> = {
    items: items.map(toNotificationDto),
    nextCursor:
      rows.length > query.limit && last
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
