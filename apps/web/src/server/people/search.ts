import { Prisma, getDb } from "@gistroom/db";
import type { PersonResult } from "@gistroom/shared";
import { decodeCursor, encodeCursor, escapeLike } from "../cursor";
import { blockedIdsOf, friendIdsOf, relationshipFor } from "../friends/relations";
import { toPublicUser } from "../users/serialize";

interface Row {
  id: string;
  score: number;
}

interface Cursor {
  score: number;
  id: string;
}

const isCursor = (v: unknown): v is Cursor =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Cursor).score === "number" &&
  typeof (v as Cursor).id === "string";

export interface SearchPage {
  people: PersonResult[];
  nextCursor: string | null;
}

/**
 * Name and username search only, never email or phone (Section 9.1).
 * This is one of the two documented raw trigram queries (R7). Excludes yourself, blocked people either way,
 * deleted, suspended, non discoverable and not yet onboarded accounts.
 */
export async function searchPeople(
  viewerId: string,
  query: string,
  limit: number,
  cursor: string | null,
  viewerInternal = false,
): Promise<SearchPage> {
  const db = getDb();
  const q = query.trim().toLowerCase();
  const like = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;
  const hidden = await blockedIdsOf(viewerId);
  const after = decodeCursor(cursor, isCursor);

  const cursorSql = after
    ? Prisma.sql`AND (score < ${after.score} OR (score = ${after.score} AND id > ${after.id}))`
    : Prisma.empty;
  const hiddenSql =
    hidden.length > 0 ? Prisma.sql`AND u."id" NOT IN (${Prisma.join(hidden)})` : Prisma.empty;

  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    SELECT id, score FROM (
      SELECT u."id" AS id,
        (GREATEST(similarity(lower(u."name"), ${q}), similarity(u."username", ${q}))
          + CASE WHEN u."username" LIKE ${prefix} OR lower(u."name") LIKE ${prefix} THEN 0.5 ELSE 0 END)::float8 AS score
      FROM "User" u
      WHERE u."status" = 'ACTIVE'
        AND u."discoverable" = true
        AND u."onboardedAt" IS NOT NULL
        AND (u."isInternal" = false OR ${viewerInternal})
        AND u."id" <> ${viewerId}
        AND (u."username" LIKE ${like} OR lower(u."name") LIKE ${like}
             OR similarity(lower(u."name"), ${q}) > 0.3 OR similarity(u."username", ${q}) > 0.3)
        ${hiddenSql}
    ) ranked
    WHERE true ${cursorSql}
    ORDER BY score DESC, id ASC
    LIMIT ${limit + 1}
  `);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last ? encodeCursor({ score: last.score, id: last.id }) : null;
  if (page.length === 0) return { people: [], nextCursor: null };

  const ids = page.map((r) => r.id);
  const [users, myFriends, theirFriendships, requests] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } } }),
    friendIdsOf(viewerId),
    db.friendship.findMany({
      where: { OR: [{ userLowId: { in: ids } }, { userHighId: { in: ids } }] },
      select: { userLowId: true, userHighId: true },
    }),
    db.friendRequest.findMany({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: { in: ids } },
          { addresseeId: viewerId, requesterId: { in: ids } },
        ],
      },
    }),
  ]);

  const mine = new Set(myFriends);
  const byId = new Map(users.map((u) => [u.id, u]));
  const now = new Date();

  const people: PersonResult[] = [];
  for (const r of page) {
    const u = byId.get(r.id);
    if (!u) continue;
    let mutual = 0;
    for (const f of theirFriendships) {
      const other = f.userLowId === u.id ? f.userHighId : f.userLowId;
      if ((f.userLowId === u.id || f.userHighId === u.id) && mine.has(other)) mutual += 1;
    }
    const rel = requests.filter((x) => x.requesterId === u.id || x.addresseeId === u.id);
    people.push({
      ...toPublicUser(u),
      mutualFriends: mutual,
      relationship: relationshipFor({
        isFriend: mine.has(u.id),
        blocked: false,
        sentPending: rel.some((x) => x.requesterId === viewerId && x.status === "PENDING"),
        receivedPending: rel.some((x) => x.addresseeId === viewerId && x.status === "PENDING"),
        cooldownActive: rel.some(
          (x) =>
            x.requesterId === viewerId &&
            x.status === "REJECTED" &&
            x.retryAfter !== null &&
            x.retryAfter > now,
        ),
      }),
    });
  }
  return { people, nextCursor };
}
