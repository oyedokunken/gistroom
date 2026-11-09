/**
 * Badges: what each one means, how it is earned and how many times. Everything here is pure, so the rules are tested
 * without a database and the server and the pages read the same definitions. Counts are earned from facts the server
 * holds (rooms that ended, friendships, report outcomes), never from anything the browser says.
 */

/** Bump when a rule changes. Grants record the version that earned them. */
export const BADGE_EVALUATOR_VERSION = 1;

export const BADGE_KEYS = [
  "FIRST_ROOM_HOST",
  "ROOM_HOST",
  "HELPFUL_HOST",
  "REGULAR_ATTENDEE",
  "CONVERSATION_STARTER",
  "GOOD_LISTENER",
  "COMMUNITY_BUILDER",
  "TOPIC_EXPLORER",
  "CONSISTENT_GIST",
  "TRUSTED_REPORTER",
] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

/** Facts about a person, counted by the server. */
export interface BadgeStats {
  /** Rooms they hosted that went live and ended with at least two people in them. */
  completedRoomsHosted: number;
  /** Reports against them or their rooms that are still open or being reviewed. */
  openReportsAgainst: number;
  /** Rooms they attended (not hosted) that went live and ended. */
  roomsAttended: number;
  /** Chats where they sent at least three messages, plus rooms where they stayed ten minutes. */
  meaningfulPlaces: number;
  /** Rooms they stayed in for ten minutes or more and were never removed or banned from. */
  roomsStayed: number;
  /** Friends who are active, not blocked either way and not internal accounts. */
  friends: number;
  /** Different topics across the rooms they hosted or attended. */
  distinctTopics: number;
  /** Lagos calendar days with a meaningful action. */
  activeDays: number;
  /** Their reports that were reviewed and resolved. */
  actionableReports: number;
}

export const EMPTY_BADGE_STATS: BadgeStats = {
  completedRoomsHosted: 0,
  openReportsAgainst: 0,
  roomsAttended: 0,
  meaningfulPlaces: 0,
  roomsStayed: 0,
  friends: 0,
  distinctTopics: 0,
  activeDays: 0,
  actionableReports: 0,
};

export interface BadgeDef {
  key: BadgeKey;
  name: string;
  /** Lucide icon name, resolved by the UI. */
  icon: string;
  /** One line for a tooltip and the profile list. */
  summary: string;
  /** How it is earned, in plain words. */
  rule: string;
  /** Display order, lowest first. */
  order: number;
  /** Private badges are shown to their owner only and never next to a name. */
  public: boolean;
  /** How many times the badge has been earned with these facts. Never negative, never fractional. */
  earned: (stats: BadgeStats) => number;
}

/** A whole number, never negative, and zero for anything that is not a finite number. */
const whole = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
const every = (count: number, step: number) => whole(count / step);

export const BADGES: readonly BadgeDef[] = [
  {
    key: "FIRST_ROOM_HOST",
    name: "First room host",
    icon: "Mic",
    summary: "Hosted a first room.",
    rule: "Host one room that goes live and ends with at least two people in it.",
    order: 1,
    public: true,
    earned: (s) => (s.completedRoomsHosted >= 1 ? 1 : 0),
  },
  {
    key: "ROOM_HOST",
    name: "Room host",
    icon: "Radio",
    summary: "Hosts rooms regularly.",
    rule: "Earned again for every 5 completed rooms you host.",
    order: 2,
    public: true,
    earned: (s) => every(s.completedRoomsHosted, 5),
  },
  {
    key: "HELPFUL_HOST",
    name: "Helpful host",
    icon: "HeartHandshake",
    summary: "Hosts well, with no open reports.",
    rule: "Earned again for every 10 completed rooms you host while no report against you or your rooms is open.",
    order: 3,
    public: true,
    earned: (s) => (s.openReportsAgainst > 0 ? 0 : every(s.completedRoomsHosted, 10)),
  },
  {
    key: "REGULAR_ATTENDEE",
    name: "Regular attendee",
    icon: "CalendarCheck",
    summary: "Shows up to rooms.",
    rule: "Earned again for every 5 completed rooms you attend.",
    order: 4,
    public: true,
    earned: (s) => every(s.roomsAttended, 5),
  },
  {
    key: "CONVERSATION_STARTER",
    name: "Conversation starter",
    icon: "MessagesSquare",
    summary: "Keeps real conversations going.",
    rule: "Earned again for every 10 chats where you sent at least 3 messages, or rooms where you stayed 10 minutes.",
    order: 5,
    public: true,
    earned: (s) => every(s.meaningfulPlaces, 10),
  },
  {
    key: "GOOD_LISTENER",
    name: "Good listener",
    icon: "Ear",
    summary: "Stays for the whole gist.",
    rule: "Earned again for every 5 rooms you stay in for 10 minutes or more without being removed or banned.",
    order: 6,
    public: true,
    earned: (s) => every(s.roomsStayed, 5),
  },
  {
    key: "COMMUNITY_BUILDER",
    name: "Community builder",
    icon: "Users",
    summary: "Has a wide circle of friends.",
    rule: "Earned again for every 10 friends who are active and not blocked.",
    order: 7,
    public: true,
    earned: (s) => every(s.friends, 10),
  },
  {
    key: "TOPIC_EXPLORER",
    name: "Topic explorer",
    icon: "Compass",
    summary: "Joins rooms across many topics.",
    rule: "Earned again for every 5 different topics across the rooms you host or attend.",
    order: 8,
    public: true,
    earned: (s) => every(s.distinctTopics, 5),
  },
  {
    key: "CONSISTENT_GIST",
    name: "Consistent gist",
    icon: "Flame",
    summary: "Comes back again and again.",
    rule: "Earned again for every 5 different days you take part.",
    order: 9,
    public: true,
    earned: (s) => every(s.activeDays, 5),
  },
  {
    key: "TRUSTED_REPORTER",
    name: "Trusted reporter",
    icon: "ShieldCheck",
    summary: "Helps keep Gistroom safe.",
    rule: "Earned when a report you made is reviewed and resolved, and again for every 5 more.",
    order: 10,
    public: false,
    earned: (s) => (s.actionableReports >= 1 ? 1 + every(s.actionableReports, 5) : 0),
  },
];

export const badgeByKey = (key: string): BadgeDef | undefined => BADGES.find((b) => b.key === key);

/** One badge family a person holds and how many times. */
export interface BadgeChip {
  badge: BadgeKey;
  count: number;
}

/** How many times each family is earned with these facts. */
export function evaluateBadges(stats: BadgeStats): { badge: BadgeKey; earned: number }[] {
  return BADGES.map((b) => ({ badge: b.key, earned: whole(b.earned(stats)) }));
}

/** The grants still missing: ordinals above what the person already holds, up to what the facts earn. */
export function missingGrants(
  stats: BadgeStats,
  held: readonly { badge: string; ordinal: number }[],
): { badge: BadgeKey; ordinal: number }[] {
  const out: { badge: BadgeKey; ordinal: number }[] = [];
  for (const { badge, earned } of evaluateBadges(stats)) {
    // Every ordinal ever granted counts, revoked or not, so a revoked badge is not quietly granted again.
    const top = held.filter((h) => h.badge === badge).reduce((m, h) => Math.max(m, h.ordinal), 0);
    for (let ordinal = top + 1; ordinal <= earned; ordinal++) out.push({ badge, ordinal });
  }
  return out;
}

/** Group active grants into chips in display order. Public only leaves out private badges. */
export function summarizeBadges(
  grants: readonly { badge: string; revokedAt: Date | string | null }[],
  options: { publicOnly?: boolean; limit?: number } = {},
): BadgeChip[] {
  const counts = new Map<BadgeKey, number>();
  for (const g of grants) {
    if (g.revokedAt) continue;
    const def = badgeByKey(g.badge);
    if (!def || (options.publicOnly && !def.public)) continue;
    counts.set(def.key, (counts.get(def.key) ?? 0) + 1);
  }
  const chips = BADGES.filter((b) => counts.has(b.key)).map((b) => ({
    badge: b.key,
    count: counts.get(b.key) ?? 0,
  }));
  return options.limit ? chips.slice(0, options.limit) : chips;
}

/** Shown as "x2". A single badge shows nothing, because "x1" says nothing. */
export const badgeCountLabel = (count: number): string => (count > 1 ? `x${count}` : "");

/** For screen readers: "Room host, earned 2 times". */
export function badgeAccessibleName(name: string, count: number): string {
  return count > 1 ? `${name}, earned ${count} times` : name;
}

/** The summary kept on the user row. Only what is safe to show next to a name. */
export const PUBLIC_BADGE_LIMIT = 3;

/** Parses the JSON kept on the user row back into chips, ignoring anything that is not a known badge. */
export function parseBadgeChips(value: unknown): BadgeChip[] {
  if (!Array.isArray(value)) return [];
  const out: BadgeChip[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const { badge, count } = item as { badge?: unknown; count?: unknown };
    if (typeof badge !== "string" || typeof count !== "number") continue;
    const def = badgeByKey(badge);
    if (def?.public && count >= 1) out.push({ badge: def.key, count: Math.floor(count) });
  }
  return out;
}
