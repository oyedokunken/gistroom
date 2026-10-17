import { editMessageSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { deleteForEveryone, deleteForMe, editMessage } from "@/server/chat/service";

/** ?scope=me hides it for you. ?scope=everyone replaces the bubble for both of you (first hour only). */
export const DELETE = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const { id } = await ctx.params;
  if (new URL(request.url).searchParams.get("scope") === "everyone") {
    return json({ message: await deleteForEveryone(user, id) });
  }
  await deleteForMe(user, id);
  return json({ ok: true });
});

/** Edit the text of your own message in the first 15 minutes. */
export const PATCH = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const { body } = await parseJson(request, editMessageSchema);
  return json({ message: await editMessage(user, (await ctx.params).id, body) });
});
