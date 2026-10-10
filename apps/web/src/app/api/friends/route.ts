import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { listFriends } from "@/server/friends/service";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const { user } = await requireOnboarded();
  return json({ friends: await listFriends(user) });
});
