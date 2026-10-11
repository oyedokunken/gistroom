import { updateNoteSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { deleteNote, updateNote } from "@/server/notes/service";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = api(async (request, ctx: Ctx) => {
  const { user } = await requireOnboarded();
  const { id } = await ctx.params;
  const { body } = await parseJson(request, updateNoteSchema);
  return json({ note: await updateNote(user, id, body) });
});

export const DELETE = api(async (_request, ctx: Ctx) => {
  const { user } = await requireOnboarded();
  const { id } = await ctx.params;
  await deleteNote(user, id);
  return json({ ok: true });
});
