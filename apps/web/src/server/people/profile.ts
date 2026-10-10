import { getDb, toPublicUser, type User } from "@gistroom/db";
import type { PersonResult } from "@gistroom/shared";
import { dmKeyFor } from "../cursor";
import { activeCooldown } from "../friends/rules";
import { friendIdsOf, isBlockedEitherWay, relationshipFor } from "../friends/relations";

export interface ProfileView extends PersonResult {
  conversationId: string | null;
  /** The profile owner's request I received, so the page can offer Accept. */
  pendingRequestId: string | null;
}

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

  const conversation = isFriend
    ? await db.conversation.findUnique({
        where: { dmKey: dmKeyFor(viewer.id, target.id) },
        select: { id: true },
      })
    : null;

  return {
    ...toPublicUser(target),
    mutualFriends: theirFriends.filter((id) => mine.has(id)).length,
    relationship,
    conversationId: conversation?.id ?? null,
    pendingRequestId: received?.id ?? null,
  };
}
