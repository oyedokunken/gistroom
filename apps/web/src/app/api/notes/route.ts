import { createNoteSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { createNote, listNotes, resolveScope } from "@/server/notes/service";

export const dynamic = "force-dynamic";

/** My private notes for one chat (`?conversationId=`) or one room (`?room=slug`). */
export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  const params = new URL(request.url).searchParams;
  const scope = await resolveScope(user, {
    conversationId: params.get("conversationId") ?? undefined,
    roomSlug: params.get("room") ?? undefined,
  });
  return json({ notes: await listNotes(user, scope) });
});

export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, createNoteSchema);
  const scope = await resolveScope(user, input);
  return json({ note: await createNote(user, scope, input.body) }, { status: 201 });
});
