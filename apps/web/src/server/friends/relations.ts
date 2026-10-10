import { getDb } from "@gistroom/db";
import type { Relationship } from "@gistroom/shared";
import { orderedPair } from "../cursor";

/** Ids of everyone this person is friends with. */
export async function friendIdsOf(userId: string): Promise<string[]> {
  const rows = await getDb().friendship.findMany({
    where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
    select: { userLowId: true, userHighId: true },
  });
  return rows.map((r) => (r.userLowId === userId ? r.userHighId : r.userLowId));
}

/** True when either person has blocked the other. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const n = await getDb().block.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return n > 0;
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  const { low, high } = orderedPair(a, b);
  const row = await getDb().friendship.findUnique({
    where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
    select: { id: true },
  });
  return row !== null;
}

/** Everyone who is blocked by, or has blocked, this person. */
export async function blockedIdsOf(userId: string): Promise<string[]> {
  const rows = await getDb().block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId));
}

export interface RelationInputs {
  isFriend: boolean;
  blocked: boolean;
  sentPending: boolean;
  receivedPending: boolean;
  /** A rejected request within the cooldown window also hides the Add friend action. */
  cooldownActive: boolean;
}

/** Pure mapping used by search results and profiles. */
export function relationshipFor(i: RelationInputs): Relationship {
  if (i.blocked) return "UNAVAILABLE";
  if (i.isFriend) return "FRIENDS";
  if (i.receivedPending) return "REQUEST_RECEIVED";
  if (i.sentPending) return "REQUEST_SENT";
  if (i.cooldownActive) return "UNAVAILABLE";
  return "NONE";
}
