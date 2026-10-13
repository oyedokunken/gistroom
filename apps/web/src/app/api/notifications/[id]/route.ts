import { getDb, toPublicUser } from "@gistroom/db";
import type { NotificationDetailDto, NotificationState } from "@gistroom/shared";
import { dmKeyFor } from "@/server/cursor";
import { api, assertSameOrigin, json, notFound } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { toNotificationDto } from "@/server/notifications/service";
import { publish } from "@/server/realtime";

export const dynamic = "force-dynamic";

const text = (payload: unknown, key: string): string | null => {
  const v = (payload as Record<string, unknown> | null)?.[key];
  return typeof v === "string" ? v : null;
};

/** One notification and what is true behind it right now. A deleted one is a plain 404, not an error screen. */
export const GET = api(async (_request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const db = getDb();
  const row = await db.notification.findFirst({
    where: { id: (await ctx.params).id, userId: user.id },
  });
  if (!row) throw notFound();
  const state: NotificationState = {};
  const requestId = text(row.payload, "requestId");
  if (row.type === "FRIEND_REQUEST_RECEIVED" && requestId) {
    const req = await db.friendRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    });
    if (req && req.addresseeId === user.id) {
      const friends =
        req.status === "ACCEPTED"
          ? await db.conversation.findUnique({
              where: { dmKey: dmKeyFor(req.requesterId, user.id) },
              select: { id: true },
            })
          : null;
      state.friendRequest = {
        status: req.status,
        user: toPublicUser(req.requester),
        conversationId: friends?.id ?? null,
      };
    }
  }
  const slug = text(row.payload, "roomSlug");
  if (slug) {
    const room = await db.room.findUnique({
      where: { slug },
      select: { slug: true, title: true, status: true },
    });
    if (room) state.room = room;
  }
  const dto: NotificationDetailDto = { notification: toNotificationDto(row), state };
  return json(dto);
});

export const DELETE = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const r = await getDb().notification.deleteMany({
    where: { id: (await ctx.params).id, userId: user.id },
  });
  if (r.count === 0) throw notFound();
  void publish({ type: "badge", userId: user.id });
  return json({ ok: true });
});
