import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { pastRooms } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

/** Rooms you hosted or attended that have ended. */
export const GET = api(async () => {
  const { user } = await requireOnboarded();
  return json({ rooms: await pastRooms(user) });
});
