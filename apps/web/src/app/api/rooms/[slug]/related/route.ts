import { api, json } from "@/server/http";
import { getSessionContext } from "@/server/auth/session";
import { relatedRooms } from "@/server/rooms/listing";

export const dynamic = "force-dynamic";

/**
 * Rooms related to this one: same topic first, then language, then live before upcoming and the closest start time.
 * Works signed out (public rooms only). Answers the same empty list for a room you cannot see, so nothing leaks.
 */
export const GET = api(async (_request, ctx: { params: Promise<{ slug: string }> }) => {
  const session = await getSessionContext().catch(() => null);
  const { slug } = await ctx.params;
  const rooms = await relatedRooms(session?.user ?? null, slug);
  return json({ rooms }, { headers: { "Cache-Control": "private, max-age=15" } });
});
