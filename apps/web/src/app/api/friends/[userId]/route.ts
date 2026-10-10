import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { unfriend } from "@/server/friends/service";

export const DELETE = api(async (request, ctx: { params: Promise<{ userId: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  await unfriend(user, (await ctx.params).userId);
  return json({ ok: true });
});
