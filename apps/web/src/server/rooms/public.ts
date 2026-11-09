import { logger } from "../logger";
import { unstable_cache } from "next/cache";
import type { PublicRoomCard } from "@gistroom/shared";
import { fetchRoomCards, without, type RoomFilters } from "./listing";

export type { PublicRoomCard, RoomFilters };

/** What a signed out visitor sees: public rooms only, no viewer, so the result is the same for everyone and can be cached. */
async function query(filters: RoomFilters): Promise<PublicRoomCard[]> {
  const cards = await fetchRoomCards(null, filters, "active");
  // Visitors get the public card. Fields that only matter to a signed in viewer are dropped.
  return cards.map((card) => without(card, "invitedOnly"));
}

const cached = unstable_cache(query, ["public-rooms"], { revalidate: 30 });

/** Live rooms first, then upcoming ones by start time. Cached for 30 seconds (Section 9.6). Empty on any failure. */
export async function listPublicRooms(
  filters: RoomFilters = {},
): Promise<{ rooms: PublicRoomCard[]; failed: boolean }> {
  try {
    return { rooms: await cached(filters), failed: false };
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "public rooms query failed",
    );
    return { rooms: [], failed: true };
  }
}

/** Count of live public Rooms, for the landing header. */
export async function liveRoomCount(): Promise<number> {
  const { rooms } = await listPublicRooms();
  return rooms.filter((r) => r.status === "LIVE").length;
}
