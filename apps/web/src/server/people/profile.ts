import { getDb, toPublicUser, type User } from "@gistroom/db";
import { TOPICS, canonicalTopicSlug, type BadgeChip, type PersonResult } from "@gistroom/shared";
import { badgesFor, grantBadges } from "../badges";
import { dmKeyFor } from "../cursor";
import { activeCooldown } from "../friends/rules";
import { friendIdsOf, isBlockedEitherWay, relationshipFor } from "../friends/relations";

export interface ProfileView extends PersonResult {
  conversationId: string | null;
  /** The profile owner's request I received, so the page can offer Accept. */
  pendingRequestId: string | null;
  /** When they joined. Shown as month and year. */
  joinedAt: string;
  /** Accepted friends who are still active. A count only, never the list. */
  friendCount: number;
  /** Topics they picked, by name. */
  interests: { slug: string; name: string }[];
  /** True when their email address is confirmed. The address itself is never part of a profile. */
  emailVerified: boolean;
  /** Badges for the page. Private ones only for the owner, and none for a visitor when the owner hides them. */
  badges: BadgeChip[];
  /** The owner chose to hide badges from other people. */
  badgesHidden: boolean;
}

const lastGrant = new Map<string, number>();

/**
 * A person as the viewer may see them. Returns null for anyone the viewer cannot see:
 * missing, deleted, suspended, not set up, or blocked in either direction.
 * Non discoverable people are still reachable by direct link, which is how a friend shares a profile.
 */
export async function getProfile(viewer: User, username: string): Promise<ProfileView | null> {
  const db = getDb();
  const target = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!target || target.status !== "ACTIVE" || !target.onboardedAt) return null;
  if (target.id !== viewer.id && (await isBlockedEitherWay(viewer.id, target.id))) return null;

  const [myFriends, theirFriends, requests] = await Promise.all([
    friendIdsOf(viewer.id),
    friendIdsOf(target.id),
    db.friendRequest.findMany({
      where: {
        OR: [
          { requesterId: viewer.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: viewer.id },
        ],
      },
    }),
  ]);
  const mine = new Set(myFriends);
  const isFriend = mine.has(target.id);
  const now = new Date();
  const received = requests.find((r) => r.requesterId === target.id && r.status === "PENDING");
  const relationship =
    target.id === viewer.id
      ? "NONE"
      : relationshipFor({
          isFriend,
          blocked: false,
          sentPending: requests.some((r) => r.requesterId === viewer.id && r.status === "PENDING"),
          receivedPending: Boolean(received),
          cooldownActive:
            activeCooldown(
              requests.filter((r) => r.requesterId === viewer.id && r.status === "REJECTED"),
              now,
            ) !== null,
        });

  const friendship = isFriend
    ? await db.friendship.findUnique({
        where: {
          userLowId_userHighId:
            viewer.id < target.id
              ? { userLowId: viewer.id, userHighId: target.id }
              : { userLowId: target.id, userHighId: viewer.id },
        },
        select: { createdAt: true },
      })
    : null;
  const conversation = isFriend
    ? await db.conversation.findUnique({
        where: { dmKey: dmKeyFor(viewer.id, target.id) },
        select: { id: true },
      })
    : null;

  const isMe = target.id === viewer.id;
  // The owner opening their own profile also settles any badge they have just earned.
  if (isMe && Date.now() - (lastGrant.get(target.id) ?? 0) > 10 * 60_000) {
    lastGrant.set(target.id, Date.now());
    await grantBadges(target.id).catch(() => undefined);
  }
  const [activeFriends, interestRows, badges] = await Promise.all([
    theirFriends.length
      ? db.user.count({ where: { id: { in: theirFriends }, status: "ACTIVE", isInternal: false } })
      : Promise.resolve(0),
    db.userInterest.findMany({ where: { userId: target.id }, select: { topicSlug: true } }),
    badgesFor(target.id, { includePrivate: isMe }),
  ]);
  const topicName = new Map(TOPICS.map((t) => [t.slug, t.name]));
  const interests = interestRows
    .map((r) => canonicalTopicSlug(r.topicSlug))
    .filter((slug, i, all) => all.indexOf(slug) === i && topicName.has(slug))
    .map((slug) => ({ slug, name: topicName.get(slug) ?? slug }))
    .slice(0, 12);
  const hidden = !isMe && !target.showBadges;

  return {
    ...toPublicUser(target),
    joinedAt: target.createdAt.toISOString(),
    friendCount: activeFriends,
    interests,
    emailVerified: target.emailVerifiedAt !== null,
    badges: hidden ? [] : badges,
    badgesHidden: hidden,
    mutualFriends: theirFriends.filter((id) => mine.has(id)).length,
    relationship,
    conversationId: conversation?.id ?? null,
    pendingRequestId: received?.id ?? null,
    friendsSince: friendship?.createdAt.toISOString() ?? null,
  };
}
