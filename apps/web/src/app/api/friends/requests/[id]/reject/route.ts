import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { rejectRequest } from "@/server/friends/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  await rejectRequest(user, (await ctx.params).id);
  return json({ ok: true });
});
