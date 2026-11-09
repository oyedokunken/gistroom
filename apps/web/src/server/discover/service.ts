import { getDb, type User } from "@gistroom/db";
import { TOPICS, type DiscoverFeed, type DiscoverQuery, type Language } from "@gistroom/shared";
import { getInterests, suggestedPeople } from "../interests/service";
import { fetchRoomCards, visibleRooms, type RoomFilters } from "../rooms/listing";

/** Everything the Discover page shows, from one pass over the rooms the viewer may see. */
export async function discoverFeed(viewer: User, query: DiscoverQuery): Promise<DiscoverFeed> {
  const db = getDb();
  const interests = await getInterests(viewer.id);

  const sort = query.sort === "newest" ? "newest" : "active";
  const filters: RoomFilters = {
    ...(query.topic ? { topic: query.topic } : {}),
    ...(query.language && query.language !== "all"
      ? { language: query.language.toUpperCase() as Language }
      : {}),
    ...(query.q ? { q: query.q } : {}),
  };

  // The same query, authorization and ordering as the public Rooms page, with the viewer's private rooms added.
  const [all, topicRows, people] = await Promise.all([
    fetchRoomCards(viewer, filters, sort),
    db.room.groupBy({
      by: ["topicId"],
      where: visibleRooms(viewer),
      _count: { _all: true },
    }),
    suggestedPeople(viewer.id, interests, viewer.isInternal),
  ]);
  const live = all.filter((r) => r.status === "LIVE");
  const soon = all.filter((r) => r.status === "SCHEDULED");
  const forYou = all
    .filter((r) => r.topicSlug !== null && interests.includes(r.topicSlug))
    .slice(0, 6);

  const topicIds = topicRows.map((t) => t.topicId).filter((id): id is string => id !== null);
  const topicsById = new Map(
    (
      await db.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, slug: true } })
    ).map((t) => [t.id, t.slug]),
  );
  const counts = new Map<string, number>();
  for (const t of topicRows) {
    const slug = t.topicId ? topicsById.get(t.topicId) : undefined;
    if (slug) counts.set(slug, t._count._all);
  }

  return {
    interests,
    live,
    soon,
    forYou,
    topics: TOPICS.map((t) => ({ slug: t.slug, name: t.name, rooms: counts.get(t.slug) ?? 0 })),
    people,
  };
}
