import { starSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { setStar } from "@/server/chat/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const { on } = await parseJson(request, starSchema);
  return json({ message: await setStar(user, (await ctx.params).id, on) });
});
