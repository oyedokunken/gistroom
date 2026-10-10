import { z } from "zod";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { joinRoom } from "@/server/rooms/service";

const schema = z.object({ invite: z.string().max(100).nullish() });

export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const { invite } = await parseJson(request, schema);
  return json(await joinRoom(user, (await ctx.params).slug, invite));
});
