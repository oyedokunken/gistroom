import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { acceptCall } from "@/server/calls/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  return json(await acceptCall(user, (await ctx.params).id));
});
