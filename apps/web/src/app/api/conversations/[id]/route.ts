import { conversationPatchSchema } from "@gistroom/shared";
import { api, assertSameOrigin, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { clearChat, setArchived, setMuted } from "@/server/chat/service";

export const PATCH = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const { id } = await ctx.params;
  const patch = await parseJson(request, conversationPatchSchema);
  if (patch.archived !== undefined) await setArchived(user, id, patch.archived);
  if (patch.muteMinutes !== undefined) {
    await setMuted(
      user,
      id,
      patch.muteMinutes === 0 ? null : new Date(Date.now() + patch.muteMinutes * 60_000),
    );
  }
  return json({ ok: true });
});

/** Delete chat: clear for me and remove from my list (Section 9.3). */
export const DELETE = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  await clearChat(user, (await ctx.params).id);
  return json({ ok: true });
});
