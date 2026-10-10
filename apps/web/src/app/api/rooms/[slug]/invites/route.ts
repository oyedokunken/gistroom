import { z } from "zod";
import { inviteLinkSchema, roomForwardSchema } from "@gistroom/shared";
import { api, assertSameOrigin, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import {
  createInviteLink,
  forwardRoom,
  inviteFriend,
  listInviteLinks,
  revokeInviteLink,
} from "@/server/rooms/service";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("friend"), userId: z.string().trim().min(1).max(64) }),
  z.object({ kind: z.literal("link") }).merge(inviteLinkSchema),
  z.object({ kind: z.literal("forward") }).merge(roomForwardSchema),
]);

export const GET = api(async (_request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  return json({ links: await listInviteLinks(user, (await ctx.params).slug) });
});

/** Invite a friend, make an invite link, or forward the room to chats. */
export const POST = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, schema);
  const { slug } = await ctx.params;
  if (input.kind === "friend") {
    await inviteFriend(user, slug, input.userId);
    return json({ ok: true });
  }
  if (input.kind === "link") {
    return json({ link: await createInviteLink(user, slug, input) }, { status: 201 });
  }
  return json(await forwardRoom(user, slug, input.conversationIds));
});

export const DELETE = api(async (request, ctx: { params: Promise<{ slug: string }> }) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const id = new URL(request.url).searchParams.get("linkId") ?? "";
  await revokeInviteLink(user, (await ctx.params).slug, id);
  return json({ ok: true });
});
