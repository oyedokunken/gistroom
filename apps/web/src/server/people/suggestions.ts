import { getDb, type User } from "@gistroom/db";
import {
  SUGGESTION_LIMIT,
  canonicalTopicSlug,
  rankSuggestions,
  suggestable,
  suggestionReasons,
  type FriendSuggestion,
  type SuggestionSignals,
} from "@gistroom/shared";
import { activeCooldown } from "../friends/rules";
import { blockedIdsOf, friendIdsOf, relationshipFor } from "../friends/relations";
import { getInterests } from "../interests/service";
import { toPublicUser } from "../users/serialize";

const CAP = 600;

interface Tally {
  interests: Set<string>;
  mutual: number;
  rooms: number;
}

const tally = (map: Map<string, Tally>, id: string): Tally => {
  let t = map.get(id);
  if (!t) {
    t = { interests: new Set(), mutual: 0, rooms: 0 };
    map.set(id, t);
  }
  return t;
};

/**
 * People the viewer may want to add. Candidates come from three places: people who picked the same topics, friends of
 * friends, and people who were in the same PUBLIC rooms. Each is scored with a small visible weight (see shared
 * suggestions.ts). Anyone blocked, deleted, suspended, not discoverable, already a friend, already in a pending request,
 * in a retry cooldown or dismissed by the viewer is left out. Private rooms never count, so a suggestion cannot reveal
 * who sits in one. The result is capped, ordered the same way each time, and carries only reasons the viewer may see.
 */
export async function suggestFriends(
  viewer: Pick<User, "id" | "isInternal">,
  limit: number = SUGGESTION_LIMIT,
): Promise<FriendSuggestion[]> {
  const db = getDb();
  const [interests, friends, blocked, dismissed] = await Promise.all([
    getInterests(viewer.id),
    friendIdsOf(viewer.id),
    blockedIdsOf(viewer.id),
    db.friendSuggestionDismissal.findMany({
      where: { userId: viewer.id },
      select: { targetId: true },
    }),
  ]);
  const friendSet = new Set(friends);
  const blockedSet = new Set(blocked);
  const dismissedSet = new Set(dismissed.map((d) => d.targetId));
  const mine = new Set(interests.map(canonicalTopicSlug));
  const found = new Map<string, Tally>();

  // 1. Same topics.
  if (interests.length > 0) {
    const rows = await db.userInterest.findMany({
      where: { topicSlug: { in: interests }, userId: { not: viewer.id } },
      select: { userId: true, topicSlug: true },
      take: CAP,
    });
    for (const r of rows) {
      const slug = canonicalTopicSlug(r.topicSlug);
      if (mine.has(slug)) tally(found, r.userId).interests.add(slug);
    }
  }

  // 2. Friends of friends: how many of my friends they are friends with.
  if (friends.length > 0) {
    const rows = await db.friendship.findMany({
      where: { OR: [{ userLowId: { in: friends } }, { userHighId: { in: friends } }] },
      select: { userLowId: true, userHighId: true },
      take: CAP * 2,
    });
    for (const r of rows) {
      const lowIsFriend = friendSet.has(r.userLowId);
      const highIsFriend = friendSet.has(r.userHighId);
      if (lowIsFriend === highIsFriend) continue;
      tally(found, lowIsFriend ? r.userHighId : r.userLowId).mutual += 1;
    }
  }

  // 3. Public rooms I was in, and who else was there. Private rooms are never read.
  const myRooms = await db.roomMember.findMany({
    where: {
      userId: viewer.id,
      joinedAt: { not: null },
      room: { visibility: "PUBLIC", status: { in: ["LIVE", "ENDED"] } },
    },
    select: { roomId: true },
    orderBy: { joinedAt: "desc" },
    take: 100,
  });
  if (myRooms.length > 0) {
    const rows = await db.roomMember.findMany({
      where: {
        roomId: { in: myRooms.map((r) => r.roomId) },
        joinedAt: { not: null },
        userId: { not: viewer.id },
      },
      select: { userId: true, roomId: true },
      take: CAP,
    });
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.userId}:${r.roomId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tally(found, r.userId).rooms += 1;
    }
  }

  const ids = [...found.keys()].filter(
    (id) => !friendSet.has(id) && !blockedSet.has(id) && !dismissedSet.has(id),
  );
  if (ids.length === 0) return [];

  const now = new Date();
  const [users, requests] = await Promise.all([
    db.user.findMany({
      where: {
        id: { in: ids },
        status: "ACTIVE",
        discoverable: true,
        onboardedAt: { not: null },
        ...(viewer.isInternal ? {} : { isInternal: false }),
      },
    }),
    db.friendRequest.findMany({
      where: {
        OR: [
          { requesterId: viewer.id, addresseeId: { in: ids } },
          { addresseeId: viewer.id, requesterId: { in: ids } },
        ],
      },
    }),
  ]);

  const candidates = users.flatMap((u) => {
    const t = found.get(u.id);
    if (!t) return [];
    const rel = requests.filter((r) => r.requesterId === u.id || r.addresseeId === u.id);
    const pending = rel.some((r) => r.status === "PENDING");
    const cooldown =
      activeCooldown(
        rel.filter((r) => r.requesterId === viewer.id && r.status === "REJECTED"),
        now,
      ) !== null;
    if (
      !suggestable({
        isSelf: u.id === viewer.id,
        isFriend: friendSet.has(u.id),
        blockedEitherWay: blockedSet.has(u.id),
        dismissed: dismissedSet.has(u.id),
        requestPending: pending,
        requestCooldown: cooldown,
        status: u.status,
        discoverable: u.discoverable,
        onboarded: u.onboardedAt !== null,
        isInternal: u.isInternal,
        viewerIsInternal: viewer.isInternal,
      })
    ) {
      return [];
    }
    const signals: SuggestionSignals = {
      sharedInterests: [...t.interests],
      mutualFriends: t.mutual,
      publicRoomsTogether: t.rooms,
    };
    return [{ id: u.id, user: u, signals }];
  });

  return rankSuggestions(candidates, limit).map(({ user, signals }) => ({
    ...toPublicUser(user),
    mutualFriends: signals.mutualFriends,
    relationship: relationshipFor({
      isFriend: false,
      blocked: false,
      sentPending: false,
      receivedPending: false,
      cooldownActive: false,
    }),
    sharedTopics: [...signals.sharedInterests],
    reasons: suggestionReasons(signals),
  }));
}

/** "Not interested": the person is not suggested again. Safe to repeat. */
export async function dismissSuggestion(viewerId: string, targetId: string): Promise<void> {
  if (viewerId === targetId) return;
  await getDb().friendSuggestionDismissal.createMany({
    data: [{ userId: viewerId, targetId }],
    skipDuplicates: true,
  });
}
