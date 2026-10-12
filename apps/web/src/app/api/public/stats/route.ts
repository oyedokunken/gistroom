import { getDb } from "@gistroom/db";

export const revalidate = 30;

/** Public counts for the landing header. Never fabricates numbers: any failure reports zero. */
export async function GET() {
  let liveRooms = 0;
  try {
    liveRooms = await getDb().room.count({
      where: { visibility: "PUBLIC", status: "LIVE", host: { isInternal: false } },
    });
  } catch {
    liveRooms = 0;
  }
  return Response.json(
    { liveRooms },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
