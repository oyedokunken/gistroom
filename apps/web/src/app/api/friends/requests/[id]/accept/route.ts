import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { acceptRequest } from "@/server/friends/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const { conversationId } = await acceptRequest(user, (await ctx.params).id);
  return json({ ok: true, conversationId });
});
