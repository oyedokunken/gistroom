import { z } from "zod";
import { api, assertSameOrigin, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { answerRing, ringMember } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

const ringSchema = z.object({ userId: z.string().trim().min(1).max(64) });
const answerSchema = z.object({ noRing: z.boolean().optional() });

/** A host or moderator rings an invited person. */
export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const { userId } = await parseJson(request, ringSchema);
  return json(await ringMember(user, (await ctx.params).slug, userId));
});

/** The person who was rung says no, and can ask not to be rung for this room again. */
export const DELETE = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const { noRing } = await parseJson(request, answerSchema);
  await answerRing(user, (await ctx.params).slug, { noRing });
  return json({ ok: true });
});
