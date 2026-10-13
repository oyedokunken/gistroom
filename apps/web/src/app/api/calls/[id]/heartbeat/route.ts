import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { heartbeatCall } from "@/server/calls/service";

export const dynamic = "force-dynamic";

/** "Still here" from one side of a call. Sent every few seconds while the call is on. */
export const POST = api(async (_request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  await heartbeatCall(user, (await ctx.params).id);
  return json({ ok: true });
});
