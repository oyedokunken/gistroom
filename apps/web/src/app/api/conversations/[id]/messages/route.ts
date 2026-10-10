import { LIMITS, sendTextSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { getMessages, sendMessage } from "@/server/chat/service";

export const dynamic = "force-dynamic";

export const GET = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const params = new URL(request.url).searchParams;
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || LIMITS.PAGE_SIZE_DEFAULT));
  return json(await getMessages(user, (await ctx.params).id, params.get("cursor"), limit));
});

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, sendTextSchema);
  const { message, created } = await sendMessage(user, (await ctx.params).id, {
    clientId: input.clientId,
    type: "TEXT",
    body: input.body,
    replyToId: input.replyToId ?? null,
  });
  return json({ message }, { status: created ? 201 : 200 });
});
