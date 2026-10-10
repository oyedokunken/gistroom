import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { listMembers, modLog } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

/** Who is in the room now. With ?log=1, the moderator action log (host only). */
export const GET = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const { slug } = await ctx.params;
  if (new URL(request.url).searchParams.get("log") === "1") {
    return json({ log: await modLog(user, slug) });
  }
  return json({ members: await listMembers(user, slug) });
});
