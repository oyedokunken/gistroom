import { presentActionSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { actOnPresentation, readPresentation } from "@/server/presentation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Who presents in this room, who asked for the turn, and any handoff that is open. */
export const GET = api(async (_request, ctx: Ctx) => {
  const { user } = await requireOnboarded();
  return json(await readPresentation(user, "room", (await ctx.params).slug));
});

/** Start, stop, ask for a turn, answer a request, take over or stop someone (host and moderators). */
export const POST = api(async (request, ctx: Ctx) => {
  const { user } = await requireOnboarded();
  const { action } = await parseJson(request, presentActionSchema);
  return json(await actOnPresentation(user, "room", (await ctx.params).slug, action));
});
