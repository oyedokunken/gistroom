import { roomChatSchema } from "@gistroom/shared";
import { api, assertSameOrigin, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { deleteRoomMessage, listRoomMessages, postRoomMessage } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

export const GET = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const cursor = new URL(request.url).searchParams.get("cursor");
  return json(await listRoomMessages(user, (await ctx.params).slug, cursor));
});

export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, roomChatSchema);
  return json(
    { message: await postRoomMessage(user, (await ctx.params).slug, input) },
    { status: 201 },
  );
});

/** Moderators and the host delete a message with ?id=. */
export const DELETE = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await deleteRoomMessage(user, (await ctx.params).slug, id);
  return json({ ok: true });
});
