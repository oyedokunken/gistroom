import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { timeoutCall } from "@/server/calls/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  return json(await timeoutCall(user, (await ctx.params).id));
});
