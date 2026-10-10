import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { endCall } from "@/server/calls/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  return json(await endCall(user, (await ctx.params).id));
});
