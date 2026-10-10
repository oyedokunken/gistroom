import { unstable_cache } from "next/cache";
import { getDb, type Language } from "@gistroom/db";
import type { PublicRoomCard } from "@gistroom/shared";
import { toPublicUser } from "@gistroom/db";

export type { PublicRoomCard };

export interface RoomFilters {
  topic?: string;
  language?: Language;
  q?: string;
}

async function query(filters: RoomFilters): Promise<PublicRoomCard[]> {
  const rooms = await getDb().room.findMany({
    where: {
      visibility: "PUBLIC",
      status: { in: ["LIVE", "SCHEDULED"] },
      ...(filters.topic ? { topic: { slug: filters.topic } } : {}),
      ...(filters.language ? { language: filters.language } : {}),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" as const } },
              { description: { contains: filters.q, mode: "insensitive" as const } },
              { topic: { name: { contains: filters.q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: {
      host: true,
      topic: true,
      _count: { select: { members: { where: { state: "JOINED" } } } },
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }, { scheduledFor: "asc" }],
    take: 60,
  });
  return rooms.map((r) => ({
    slug: r.slug,
    title: r.title,
    description: r.description,
    topicSlug: r.topic?.slug ?? null,
    topicName: r.topic?.name ?? null,
    language: r.language,
    status: r.status === "LIVE" ? "LIVE" : "SCHEDULED",
    scheduledFor: r.scheduledFor?.toISOString() ?? null,
    startedAt: r.startedAt?.toISOString() ?? null,
    host: toPublicUser(r.host),
    listeners: r._count.members,
  }));
}

const cached = unstable_cache(query, ["public-rooms"], { revalidate: 30 });

/** Live and scheduled public Rooms, sorted by activity. Cached for 30 seconds (Section 9.6). Empty on any failure. */
export async function listPublicRooms(
  filters: RoomFilters = {},
): Promise<{ rooms: PublicRoomCard[]; failed: boolean }> {
  try {
    return { rooms: await cached(filters), failed: false };
  } catch {
    return { rooms: [], failed: true };
  }
}

/** Count of live public Rooms, for the landing header. */
export async function liveRoomCount(): Promise<number> {
  const { rooms } = await listPublicRooms();
  return rooms.filter((r) => r.status === "LIVE").length;
}
