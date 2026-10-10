import { ackSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { acknowledge } from "@/server/chat/service";

/** Receipts over HTTP, for when the socket is down. Same rules as the socket event. */
export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const { messageId, kind } = await parseJson(request, ackSchema);
  await acknowledge(user, (await ctx.params).id, messageId, kind);
  return json({ ok: true });
});
