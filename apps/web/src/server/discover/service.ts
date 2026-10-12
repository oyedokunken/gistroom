import { getDb, toPublicUser, type Prisma, type User } from "@gistroom/db";
import {
  TOPICS,
  canonicalTopicSlug,
  type DiscoverFeed,
  type DiscoverQuery,
  type DiscoverRoom,
} from "@gistroom/shared";
import { getInterests, suggestedPeople } from "../interests/service";

const ROOM_LIMIT = 120;
const STACK = 4;

type Row = Prisma.RoomGetPayload<{
  include: {
    host: true;
    topic: true;
    members: { include: { user: true } };
    _count: { select: { members: true } };
  };
}>;

/**
 * Rooms the viewer is allowed to see on Discover: every public room that is live or coming up, plus private rooms
 * they are invited to or already in. Anything else is invisible, so a private room never leaks its title.
 */
function visibleTo(viewerId: string): Prisma.RoomWhereInput {
  return {
    status: { in: ["LIVE", "SCHEDULED"] },
    OR: [
      { visibility: "PUBLIC" },
      {
        visibility: "PRIVATE",
        members: { some: { userId: viewerId, state: { in: ["INVITED", "JOINED"] } } },
      },
    ],
  };
}

function toCard(row: Row, viewerId: string): DiscoverRoom {
  const mine = row.members.find((m) => m.userId === viewerId);
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    topicSlug: row.topic?.slug ?? null,
    topicName: row.topic?.name ?? null,
    language: row.language,
    status: row.status === "LIVE" ? "LIVE" : "SCHEDULED",
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    host: toPublicUser(row.host),
    listeners: row._count.members,
    media: row.media,
    people: row.members
      .filter((m) => m.state === "JOINED")
      .slice(0, STACK)
      .map((m) => toPublicUser(m.user)),
    invitedOnly: row.visibility === "PRIVATE" && mine !== undefined,
  };
}

/** How busy a room is, for the "most active" sort. */
export const byActivity = (a: DiscoverRoom, b: DiscoverRoom): number =>
  b.listeners - a.listeners ||
  (b.startedAt ?? "").localeCompare(a.startedAt ?? "") ||
  a.title.localeCompare(b.title);

export const byNewest = (a: DiscoverRoom, b: DiscoverRoom): number =>
  (b.startedAt ?? b.scheduledFor ?? "").localeCompare(a.startedAt ?? a.scheduledFor ?? "");

/** Soonest first for rooms that have not started yet. */
export const bySoonest = (a: DiscoverRoom, b: DiscoverRoom): number =>
  (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "");

/** Everything the Discover page shows, from one pass over the rooms the viewer may see. */
export async function discoverFeed(viewer: User, query: DiscoverQuery): Promise<DiscoverFeed> {
  const db = getDb();
  const interests = await getInterests(viewer.id);

  const filters: Prisma.RoomWhereInput[] = [];
  if (query.topic) filters.push({ topic: { slug: canonicalTopicSlug(query.topic) } });
  if (query.language && query.language !== "all") {
    filters.push({ language: query.language.toUpperCase() as Row["language"] });
  }
  if (query.q) filters.push({ title: { contains: query.q, mode: "insensitive" } });

  const include = {
    host: true,
    topic: true,
    members: {
      where: { state: { in: ["JOINED", "INVITED"] as ("JOINED" | "INVITED")[] } },
      include: { user: true },
      orderBy: { joinedAt: "asc" as const },
    },
    _count: { select: { members: { where: { state: "JOINED" as const } } } },
  };

  const [rows, topicRows, people] = await Promise.all([
    db.room.findMany({
      where: { AND: [visibleTo(viewer.id), ...filters] },
      include,
      orderBy: [{ startedAt: "desc" }, { scheduledFor: "asc" }],
      take: ROOM_LIMIT,
    }),
    db.room.groupBy({
      by: ["topicId"],
      where: visibleTo(viewer.id),
      _count: { _all: true },
    }),
    suggestedPeople(viewer.id, interests, viewer.isInternal),
  ]);

  const all = rows.map((r) => toCard(r, viewer.id));
  const sort = query.sort === "newest" ? byNewest : byActivity;
  const live = all.filter((r) => r.status === "LIVE").sort(sort);
  const soon = all.filter((r) => r.status === "SCHEDULED").sort(bySoonest);
  const forYou = all
    .filter((r) => r.topicSlug !== null && interests.includes(r.topicSlug))
    .sort(sort)
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
