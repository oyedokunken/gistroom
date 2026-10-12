import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { roomSummary } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

/** The record an ended room leaves behind. */
export const GET = api(async (_request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  return json({ summary: await roomSummary(user, (await ctx.params).slug) });
});
