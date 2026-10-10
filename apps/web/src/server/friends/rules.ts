import { LIMITS } from "@gistroom/shared";

export type SendDecision =
  | { action: "SEND" }
  | { action: "AUTO_ACCEPT"; requestId: string }
  | { action: "ALREADY_FRIENDS" }
  | { action: "ALREADY_SENT" }
  | { action: "REFUSE"; reason: "SELF" | "UNAVAILABLE" };

export interface SendInputs {
  selfId: string;
  targetId: string;
  blocked: boolean;
  isFriend: boolean;
  sentPendingId: string | null;
  receivedPendingId: string | null;
  /** End of the cooldown after this person rejected an earlier request from me. */
  cooldownUntil: Date | null;
  targetActive: boolean;
  now: Date;
}

/**
 * What happens when I ask someone to be friends (Section 9.2).
 * Blocks, deleted accounts and the rejection cooldown all give the same "unavailable" answer,
 * so nobody learns that they were blocked or rejected.
 */
export function decideSend(i: SendInputs): SendDecision {
  if (i.selfId === i.targetId) return { action: "REFUSE", reason: "SELF" };
  if (i.blocked || !i.targetActive) return { action: "REFUSE", reason: "UNAVAILABLE" };
  if (i.isFriend) return { action: "ALREADY_FRIENDS" };
  // They already asked me: sending a request back means yes. This also covers both of us sending at once.
  if (i.receivedPendingId) return { action: "AUTO_ACCEPT", requestId: i.receivedPendingId };
  if (i.sentPendingId) return { action: "ALREADY_SENT" };
  if (i.cooldownUntil && i.cooldownUntil > i.now)
    return { action: "REFUSE", reason: "UNAVAILABLE" };
  return { action: "SEND" };
}

/** When a rejected sender may try again: seven days. */
export function retryAfter(now: Date): Date {
  return new Date(now.getTime() + LIMITS.FRIEND_REQUEST_COOLDOWN_DAYS * 86_400_000);
}

/** The latest active cooldown across earlier rejected requests, or null. */
export function activeCooldown(
  rejected: readonly { retryAfter: Date | null }[],
  now: Date,
): Date | null {
  let latest: Date | null = null;
  for (const r of rejected) {
    if (r.retryAfter && r.retryAfter > now && (!latest || r.retryAfter > latest))
      latest = r.retryAfter;
  }
  return latest;
}

/** Messaging, calls and Room invites need an accepted friendship and no block either way (Section 9.2). */
export function canInteract(input: { isFriend: boolean; blocked: boolean }): boolean {
  return input.isFriend && !input.blocked;
}
