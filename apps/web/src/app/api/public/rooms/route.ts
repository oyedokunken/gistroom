import { api, json } from "@/server/http";
import { listPublicRooms } from "@/server/rooms/public";

export const dynamic = "force-dynamic";

/** Public room search for the rooms page. Matches title, topic and description. Short results, cached upstream. */
export const GET = api(async (request) => {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const { rooms, failed } = await listPublicRooms(q ? { q } : {});
  return json({ rooms, failed }, { headers: { "Cache-Control": "public, max-age=10" } });
});
