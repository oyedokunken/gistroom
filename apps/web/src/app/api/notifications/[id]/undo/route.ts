import { getDb } from "@gistroom/db";
import { api, json, notFound } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { setArchived } from "@/server/chat/service";
import { unblockUser } from "@/server/friends/service";
import type { ActivityUndo } from "@/server/notifications/activity";

/** Reverses what an Activity line recorded: unarchive a chat, or unblock a person. The line goes away after. */
export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const row = await getDb().notification.findFirst({
    where: { id: (await ctx.params).id, userId: user.id, type: "ACTIVITY" },
  });
  if (!row) throw notFound();
  const undo = (row.payload as { undo?: ActivityUndo } | null)?.undo;
  if (!undo) throw notFound();
  if (undo.action === "unarchive") await setArchived(user, undo.conversationId, false);
  else await unblockUser(user, undo.userId);
  await getDb().notification.delete({ where: { id: row.id } });
  return json({ ok: true });
});
