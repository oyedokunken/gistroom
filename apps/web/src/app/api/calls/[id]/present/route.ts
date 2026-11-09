import { presentActionSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { actOnPresentation, readPresentation } from "@/server/presentation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Who presents in this call, who asked for the turn, and any handoff that is open. */
export const GET = api(async (_request, ctx: Ctx) => {
  const { user } = await requireOnboarded();
  return json(await readPresentation(user, "call", (await ctx.params).id));
});

/** Start, stop, ask for a turn or answer a request. In a call nobody can stop the other person's screen. */
export const POST = api(async (request, ctx: Ctx) => {
  const { user } = await requireOnboarded();
  const { action } = await parseJson(request, presentActionSchema);
  return json(await actOnPresentation(user, "call", (await ctx.params).id, action));
});
