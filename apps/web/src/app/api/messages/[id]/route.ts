import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { deleteForEveryone, deleteForMe } from "@/server/chat/service";

/** ?scope=me hides it for you. ?scope=everyone replaces the bubble for both of you (first hour only). */
export const DELETE = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const { id } = await ctx.params;
  if (new URL(request.url).searchParams.get("scope") === "everyone") {
    return json({ message: await deleteForEveryone(user, id) });
  }
  await deleteForMe(user, id);
  return json({ ok: true });
});
