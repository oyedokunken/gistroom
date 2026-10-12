import { getDb } from "@gistroom/db";
import { topicBySlug, type SuggestedPerson } from "@gistroom/shared";
import { blockedIdsOf, friendIdsOf, relationshipFor } from "../friends/relations";
import { toPublicUser } from "../users/serialize";

export async function getInterests(userId: string): Promise<string[]> {
  const rows = await getDb().userInterest.findMany({
    where: { userId },
    select: { topicSlug: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.topicSlug);
}

/** Replaces the whole list in one step. Unknown slugs never reach here, the schema refuses them. */
export async function setInterests(userId: string, slugs: readonly string[]): Promise<string[]> {
  const unique = [...new Set(slugs)];
  const db = getDb();
  await db.$transaction([
    db.userInterest.deleteMany({ where: { userId } }),
    db.userInterest.createMany({ data: unique.map((topicSlug) => ({ userId, topicSlug })) }),
  ]);
  return unique;
}

/** Public rooms on the topics a person picked, and people who picked some of the same ones. */
/** People who picked some of the same topics as the viewer, most shared first. Never friends, blocked people or hidden accounts. */
export async function suggestedPeople(
  viewerId: string,
  interests: string[],
  viewerIsInternal = false,
): Promise<SuggestedPerson[]> {
  const db = getDb();
  if (interests.length === 0) return [];

  const [hidden, friends] = await Promise.all([blockedIdsOf(viewerId), friendIdsOf(viewerId)]);
  const rows = await db.userInterest.findMany({
    where: {
      topicSlug: { in: interests },
      userId: { not: viewerId, notIn: [...hidden, ...friends] },
      user: {
        status: "ACTIVE",
        discoverable: true,
        onboardedAt: { not: null },
        ...(viewerIsInternal ? {} : { isInternal: false }),
      },
    },
    select: { userId: true, topicSlug: true },
    take: 500,
  });
  const shared = new Map<string, string[]>();
  for (const r of rows) shared.set(r.userId, [...(shared.get(r.userId) ?? []), r.topicSlug]);
  const ranked = [...shared.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12);
  if (ranked.length === 0) return [];

  const ids = ranked.map(([id]) => id);
  const now = new Date();
  const [users, requests] = await Promise.all([
    db.user.findMany({ where: { id: { in: ids } } }),
    db.friendRequest.findMany({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: { in: ids } },
          { addresseeId: viewerId, requesterId: { in: ids } },
        ],
      },
    }),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const people: SuggestedPerson[] = [];
  for (const [id, slugs] of ranked) {
    const u = byId.get(id);
    if (!u) continue;
    const rel = requests.filter((x) => x.requesterId === id || x.addresseeId === id);
    people.push({
      ...toPublicUser(u),
      mutualFriends: 0,
      relationship: relationshipFor({
        isFriend: false,
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
      sharedTopics: slugs.map((s) => topicBySlug(s)?.name ?? s),
    });
  }
  return people;
}
