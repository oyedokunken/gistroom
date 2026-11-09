import { LIMITS } from "./limits";
import { defaultSwitches, inQuietHours, type NotificationPrefs } from "./notifications";

/**
 * Who is due a "come back" nudge, and when. Pure functions only: the sweep reads the facts and asks these.
 *
 * Decision D105: a person is inactive when BOTH signals are older than the cutoff: no meaningful action
 * (`User.lastActiveAt`, which only moves for real actions such as a message, a call or a room) and no session seen
 * (the latest `Session.lastSeenAt` or the socket `User.lastSeenAt`). Someone who only holds an old session counts as
 * inactive. When a signal is missing the account's creation date stands in, so a new account is never nudged on day one.
 */

const DAY_MS = 86_400_000;

export interface ActivityFacts {
  lastActiveAt: Date | null;
  /** The newest of the person's session activity: the latest session `lastSeenAt` or the socket `lastSeenAt`. */
  lastSessionAt: Date | null;
  createdAt: Date;
}

/** The moment the person was last seen doing anything. This anchors the inactivity spell. */
export function lastSignalAt(f: ActivityFacts): Date {
  const times = [f.lastActiveAt, f.lastSessionAt, f.createdAt]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  return new Date(Math.max(...times));
}

export function isInactive(
  f: ActivityFacts,
  now: Date,
  days: number = LIMITS.REENGAGE_INACTIVE_DAYS,
): boolean {
  return now.getTime() - lastSignalAt(f).getTime() > days * DAY_MS;
}

/**
 * The key of one inactivity spell: the calendar day (UTC) of the last signal. Coming back and going quiet again moves
 * the anchor, so it starts a new spell. Used with the user id for the unique (userId, windowStart) record.
 */
export function windowStartOf(f: ActivityFacts): Date {
  const t = lastSignalAt(f);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

export interface NoticeHistory {
  /** When earlier notices to this person were sent (any spell). */
  sentAt: Date[];
  /** Spell keys that already have a notice or a recorded decision. */
  windows: Date[];
}

export type ReengageDecision =
  { send: true } | { send: false; reason: "ACTIVE" | "SAME_WINDOW" | "COOLDOWN" | "YEARLY_CAP" };

export function decideReengage(
  facts: ActivityFacts,
  history: NoticeHistory,
  now: Date,
  opts: { days?: number; cooldownDays?: number; maxPerYear?: number } = {},
): ReengageDecision {
  const days = opts.days ?? LIMITS.REENGAGE_INACTIVE_DAYS;
  const cooldownDays = opts.cooldownDays ?? LIMITS.REENGAGE_COOLDOWN_DAYS;
  const maxPerYear = opts.maxPerYear ?? LIMITS.REENGAGE_MAX_PER_YEAR;
  if (!isInactive(facts, now, days)) return { send: false, reason: "ACTIVE" };
  const window = windowStartOf(facts).getTime();
  if (history.windows.some((w) => w.getTime() === window)) {
    return { send: false, reason: "SAME_WINDOW" };
  }
  const t = now.getTime();
  if (history.sentAt.some((d) => t - d.getTime() < cooldownDays * DAY_MS)) {
    return { send: false, reason: "COOLDOWN" };
  }
  if (history.sentAt.filter((d) => t - d.getTime() < 365 * DAY_MS).length >= maxPerYear) {
    return { send: false, reason: "YEARLY_CAP" };
  }
  return { send: true };
}

/** The deduplication key of the in-app notice and the email for one spell. */
export function reengageKey(userId: string, windowStart: Date): string {
  return `reengage:${userId}:${windowStart.toISOString().slice(0, 10)}`;
}

/** After three failed sends the email for that spell is given up on. */
export const REENGAGE_MAX_ATTEMPTS = 3;

/**
 * Whether the come back email may go now. OFF is final for the spell (the person switched it off), QUIET is held and
 * tried again on a later run, so it is never recorded.
 */
export function reengageEmailGate(input: {
  prefs: NotificationPrefs;
  timeZone: string;
  now: Date;
}): "SEND" | "OFF" | "QUIET" {
  const sw = input.prefs.switches["REENGAGE"] ?? defaultSwitches("REENGAGE");
  if (!sw.email) return "OFF";
  const quiet = inQuietHours(
    input.now,
    input.timeZone,
    input.prefs.quietStart,
    input.prefs.quietEnd,
  );
  return quiet ? "QUIET" : "SEND";
}
