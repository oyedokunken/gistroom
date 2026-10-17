import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { declineCall } from "@/server/calls/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  return json(await declineCall(user, (await ctx.params).id));
});
