import { getDb } from "@gistroom/db";
import { LIMITS, type NotificationDto, type Page } from "@gistroom/shared";
import { decodeCursor, encodeCursor } from "@/server/cursor";
import { api, assertSameOrigin, json } from "@/server/http";
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
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || LIMITS.PAGE_SIZE_DEFAULT));
  const after = decodeCursor(params.get("cursor"), isCursor);
  const afterDate = after ? new Date(after.t) : null;

  const rows = await getDb().notification.findMany({
    where: {
      userId: user.id,
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

/** Clear all of them (Section 9.7). */
export const DELETE = api(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  await getDb().notification.deleteMany({ where: { userId: user.id } });
  void publish({ type: "badge", userId: user.id });
  return json({ ok: true });
});
