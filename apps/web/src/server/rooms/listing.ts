import { getDb, toPublicUser, type Prisma, type User } from "@gistroom/db";
import {
  canonicalTopicSlug,
  rankRelated,
  sortRoomCards,
  type DiscoverRoom,
  type Language,
  type PublicRoomCard,
  type RoomSort,
} from "@gistroom/shared";

/**
 * The one query behind every list of rooms: /rooms (signed out, cached), Discover and the related rooms list. The same
 * authorization, filters, ordering and card shape everywhere, so the pages cannot disagree about which rooms exist.
 */

export interface RoomFilters {
  topic?: string;
  language?: Language;
  q?: string;
}

export const ROOM_LIST_LIMIT = 120;
const STACK = 4;

const include = {
  host: true,
  topic: true,
  members: {
    where: { state: { in: ["JOINED", "INVITED"] as ("JOINED" | "INVITED")[] } },
    include: { user: true },
    orderBy: { joinedAt: "asc" as const },
  },
} satisfies Prisma.RoomInclude;

type Row = Prisma.RoomGetPayload<{ include: typeof include }>;

/**
 * Rooms a viewer may see. Everyone sees public live and upcoming rooms. A signed in viewer also sees the private rooms
 * they are invited to or in. Rooms run by internal QA accounts are only seen by other internal accounts.
 */
export function visibleRooms(
  viewer: { id: string; isInternal: boolean } | null,
): Prisma.RoomWhereInput {
  return {
    status: { in: ["LIVE", "SCHEDULED"] },
    ...(viewer?.isInternal ? {} : { host: { isInternal: false } }),
    OR: [
      { visibility: "PUBLIC" },
      ...(viewer
        ? [
            {
              visibility: "PRIVATE" as const,
              members: {
                some: {
                  userId: viewer.id,
                  state: { in: ["INVITED", "JOINED"] as ("INVITED" | "JOINED")[] },
                },
              },
            },
          ]
        : []),
    ],
  };
}

export function filterWhere(filters: RoomFilters): Prisma.RoomWhereInput[] {
  const out: Prisma.RoomWhereInput[] = [];
  if (filters.topic) out.push({ topic: { slug: canonicalTopicSlug(filters.topic) } });
  if (filters.language) out.push({ language: filters.language });
  if (filters.q) {
    out.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { topic: { name: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }
  return out;
}

export function toRoomCard(
  row: Row,
  viewer: { id: string; isInternal: boolean } | null,
): DiscoverRoom {
  const showInternal = viewer?.isInternal === true;
  const people = row.members.filter((m) => showInternal || !m.user.isInternal);
  const joined = people.filter((m) => m.state === "JOINED");
  const mine = viewer ? row.members.find((m) => m.userId === viewer.id) : undefined;
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
    listeners: joined.length,
    media: row.media,
    people: joined.slice(0, STACK).map((m) => toPublicUser(m.user)),
    attending: people.filter((m) => m.state === "INVITED" && m.registeredAt !== null).length,
    invitedOnly: row.visibility === "PRIVATE" && mine !== undefined,
  };
}

/** A copy of an object without some keys. */
export function without<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...obj };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Live and upcoming rooms for a viewer (null for a signed out visitor), filtered and sorted. */
export async function fetchRoomCards(
  viewer: Pick<User, "id" | "isInternal"> | null,
  filters: RoomFilters = {},
  sort: RoomSort = "active",
): Promise<DiscoverRoom[]> {
  const db = getDb();
  const base = { AND: [visibleRooms(viewer), ...filterWhere(filters)] };
  // Two queries, so a long list of upcoming rooms can never push a live room off the list.
  const [live, soon] = await Promise.all([
    db.room.findMany({
      where: { AND: [base, { status: "LIVE" }] },
      include,
      orderBy: { startedAt: "desc" },
      take: ROOM_LIST_LIMIT,
    }),
    db.room.findMany({
      where: { AND: [base, { status: "SCHEDULED" }] },
      include,
      orderBy: { scheduledFor: "asc" },
      take: ROOM_LIST_LIMIT,
    }),
  ]);
  return sortRoomCards(
    [...live, ...soon].map((r) => toRoomCard(r, viewer)),
    sort,
  );
}

export { include as roomCardInclude };

/**
 * Rooms related to one room, for the page of that room. The candidates are the rooms this viewer may already see on the
 * list, so a private room that is not theirs can never be recommended. When the room itself is not on the viewer's list
 * (private and not theirs, ended, missing) the answer is an empty list, the same as when nothing is related, so the
 * request tells nothing about the room.
 */
export async function relatedRooms(
  viewer: Pick<User, "id" | "isInternal"> | null,
  slug: string,
  limit = 6,
): Promise<PublicRoomCard[]> {
  const cards = await fetchRoomCards(viewer, {}, "active");
  const target = cards.find((c) => c.slug === slug);
  if (!target) return [];
  const ranked = rankRelated(
    {
      slug: target.slug,
      topicSlug: target.topicSlug,
      language: target.language,
      scheduledFor: target.scheduledFor,
    },
    cards.map((c) => ({
      ...c,
      visibility: c.invitedOnly ? ("PRIVATE" as const) : ("PUBLIC" as const),
      accessible: true,
    })),
    new Date(),
    limit,
  );
  return ranked.map((r) => without(r, "visibility", "accessible"));
}
