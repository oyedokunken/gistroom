import { modActionSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { moderate } from "@/server/rooms/service";

export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, modActionSchema);
  await moderate(user, (await ctx.params).slug, input);
  return json({ ok: true });
});
