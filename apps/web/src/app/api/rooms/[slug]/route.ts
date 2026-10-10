import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { viewRoom } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

/** The room as you may see it. A private room you are not in answers NOT_INVITED and nothing else. */
export const GET = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const invite = new URL(request.url).searchParams.get("invite");
  return json(await viewRoom(user, (await ctx.params).slug, invite));
});
