import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { cancelRequest } from "@/server/friends/service";

export const DELETE = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  await cancelRequest(user, (await ctx.params).id);
  return json({ ok: true });
});
