import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { heartbeatRoom } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

/** "Still here" from a tab inside a room. Sent every few seconds while you are in it. */
export const POST = api(async (_request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  await heartbeatRoom(user, (await ctx.params).slug);
  return json({ ok: true });
});
