import { reportSchema } from "@gistroom/shared";
import { api, assertSameOrigin, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { reportChat } from "@/server/chat/reports";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const input = await parseJson(request, reportSchema);
  return json(await reportChat(user, (await ctx.params).id, input));
});
