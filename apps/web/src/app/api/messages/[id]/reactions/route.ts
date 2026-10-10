import { reactionSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { toggleReaction } from "@/server/chat/service";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const { emoji } = await parseJson(request, reactionSchema);
  return json({ message: await toggleReaction(user, (await ctx.params).id, emoji) });
});
