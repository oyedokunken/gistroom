import { api, json, notFound } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { getProfile } from "@/server/people/profile";

export const dynamic = "force-dynamic";

export const GET = api(async (_request, ctx: { params: Promise<{ username: string }> }) => {
  const { user } = await requireOnboarded();
  const profile = await getProfile(user, (await ctx.params).username);
  if (!profile) throw notFound();
  return json({ profile });
});
