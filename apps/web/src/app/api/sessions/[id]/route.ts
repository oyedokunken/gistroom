import { api, json, notFound } from "@/server/http";
import { requireUser, revokeSession } from "@/server/auth/session";

export const DELETE = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser();
  const { id } = await ctx.params;
  const done = await revokeSession(id, user.id);
  if (!done) throw notFound();
  return json({ ok: true });
});
