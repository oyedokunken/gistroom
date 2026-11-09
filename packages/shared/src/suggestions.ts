import type { SuggestedPerson } from "./profile";

/**
 * Suggested friends. A small, explainable ranking: shared interests, mutual friends and public rooms in common, each
 * with a visible weight. There is no hidden score. The reasons given to the viewer are only facts the other person
 * already shows on their profile (interests, a friend count in common) or that are public (a public room), never a
 * private room, a location or anything inferred. Location and language are not used, because nobody has consented to
 * share either (decision D97).
 */

export const SUGGESTION_LIMIT = 12;
export const SUGGESTION_WEIGHTS = {
  /** Per interest in common. */
  interest: 3,
  /** Per mutual friend, up to MUTUAL_CAP. */
  mutual: 4,
  /** Per public room attended together, up to ROOM_CAP. */
  room: 2,
} as const;
const MUTUAL_CAP = 10;
const ROOM_CAP = 5;

export interface SuggestionSignals {
  sharedInterests: readonly string[];
  mutualFriends: number;
  /** Completed or live PUBLIC rooms both people were in. Private rooms are never counted. */
  publicRoomsTogether: number;
}

export function suggestionScore(s: SuggestionSignals): number {
  const mutual = Math.min(Math.max(0, Math.floor(s.mutualFriends)), MUTUAL_CAP);
  const rooms = Math.min(Math.max(0, Math.floor(s.publicRoomsTogether)), ROOM_CAP);
  return (
    s.sharedInterests.length * SUGGESTION_WEIGHTS.interest +
    mutual * SUGGESTION_WEIGHTS.mutual +
    rooms * SUGGESTION_WEIGHTS.room
  );
}

/** Plain reasons, in the order of their weight. Empty when there is no signal at all. */
export function suggestionReasons(s: SuggestionSignals): string[] {
  const out: string[] = [];
  if (s.mutualFriends > 0) {
    out.push(s.mutualFriends === 1 ? "1 mutual friend" : `${s.mutualFriends} mutual friends`);
  }
  if (s.sharedInterests.length > 0) {
    out.push(
      s.sharedInterests.length === 1
        ? "1 interest in common"
        : `${s.sharedInterests.length} interests in common`,
    );
  }
  if (s.publicRoomsTogether > 0) out.push("Often in the same public rooms");
  return out;
}

/** Highest score first. Ties go by id, so the order is the same every time the list is asked for. */
export function rankSuggestions<T extends { id: string; signals: SuggestionSignals }>(
  candidates: readonly T[],
  limit: number = SUGGESTION_LIMIT,
): T[] {
  return candidates
    .filter((c) => suggestionScore(c.signals) > 0)
    .sort(
      (a, b) => suggestionScore(b.signals) - suggestionScore(a.signals) || a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}

/** Everything that keeps someone off the list. Kept as one pure check so each rule is tested. */
export interface SuggestionEligibility {
  isSelf: boolean;
  isFriend: boolean;
  blockedEitherWay: boolean;
  dismissed: boolean;
  requestPending: boolean;
  requestCooldown: boolean;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  discoverable: boolean;
  onboarded: boolean;
  isInternal: boolean;
  viewerIsInternal: boolean;
}

export function suggestable(e: SuggestionEligibility): boolean {
  if (e.isSelf || e.isFriend || e.blockedEitherWay || e.dismissed) return false;
  if (e.requestPending || e.requestCooldown) return false;
  if (e.status !== "ACTIVE" || !e.discoverable || !e.onboarded) return false;
  if (e.isInternal && !e.viewerIsInternal) return false;
  return true;
}

/** A suggested person as the Find people tab shows them. */
export interface FriendSuggestion extends SuggestedPerson {
  /** Plain reasons, only facts the person already shows or that are public. Never a private room or a location. */
  reasons: string[];
}
