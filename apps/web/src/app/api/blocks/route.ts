import { getDb, toPublicUser } from "@gistroom/db";
import { userIdSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { blockUser } from "@/server/friends/service";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const { user } = await requireOnboarded();
  const rows = await getDb().block.findMany({
    where: { blockerId: user.id },
    include: { blocked: true },
    orderBy: { createdAt: "desc" },
  });
  return json({ blocked: rows.map((r) => toPublicUser(r.blocked)) });
});

export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const { userId } = await parseJson(request, userIdSchema);
  await blockUser(user, userId);
  return json({ ok: true });
});
