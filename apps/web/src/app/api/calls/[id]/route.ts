import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { getCall } from "@/server/calls/service";

export const dynamic = "force-dynamic";

export const GET = api(async (_request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  return json(await getCall(user, (await ctx.params).id));
});
