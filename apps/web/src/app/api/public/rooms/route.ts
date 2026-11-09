import { publicRoomsQuerySchema } from "@gistroom/shared";
import { api, json } from "@/server/http";
import { listPublicRooms } from "@/server/rooms/public";

export const dynamic = "force-dynamic";

/** Public room search for the rooms page. Same filters as Discover: title, description and topic text, topic, language. */
export const GET = api(async (request) => {
  const params = new URL(request.url).searchParams;
  const parsed = publicRoomsQuerySchema.safeParse({
    q: params.get("q") ?? undefined,
    topic: params.get("topic") ?? undefined,
    language: params.get("language") ?? undefined,
  });
  const filters = parsed.success ? parsed.data : {};
  const { rooms, failed } = await listPublicRooms(filters);
  return json({ rooms, failed }, { headers: { "Cache-Control": "public, max-age=10" } });
});
