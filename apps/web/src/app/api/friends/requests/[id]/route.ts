import { getDb, toPublicUser } from "@gistroom/db";
import type { FriendRequestDto } from "@gistroom/shared";
import { api, json, notFound } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { cancelRequest } from "@/server/friends/service";

/** One request with the other person's public profile, for the person who sent it or received it. */
export const GET = api(async (_request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const row = await getDb().friendRequest.findUnique({
    where: { id: (await ctx.params).id },
    include: { requester: true, addressee: true },
  });
  if (!row || (row.requesterId !== user.id && row.addresseeId !== user.id)) throw notFound();
  const incoming = row.addresseeId === user.id;
  const dto: FriendRequestDto = {
    id: row.id,
    direction: incoming ? "INCOMING" : "OUTGOING",
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    user: toPublicUser(incoming ? row.requester : row.addressee),
  };
  return json({ request: dto });
});

export const DELETE = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  await cancelRequest(user, (await ctx.params).id);
  return json({ ok: true });
});
