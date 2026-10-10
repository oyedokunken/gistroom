import { getDb } from "@gistroom/db";
import { api, assertSameOrigin, json, notFound } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { publish } from "@/server/realtime";

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
