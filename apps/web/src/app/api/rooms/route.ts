import { createRoomSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { createRoom, myRooms } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

/** Rooms you host or were invited to. */
export const GET = api(async () => {
  const { user } = await requireOnboarded();
  return json({ rooms: await myRooms(user) });
});

export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, createRoomSchema);
  return json({ room: await createRoom(user, input) }, { status: 201 });
});
