import { describe, expect, it } from "vitest";
import {
  BADGES,
  BADGE_KEYS,
  EMPTY_BADGE_STATS,
  badgeAccessibleName,
  badgeCountLabel,
  evaluateBadges,
  missingGrants,
  parseBadgeChips,
  summarizeBadges,
  type BadgeStats,
} from "../../packages/shared/src";

const stats = (over: Partial<BadgeStats>): BadgeStats => ({ ...EMPTY_BADGE_STATS, ...over });
const earned = (s: BadgeStats, key: string) =>
  evaluateBadges(s).find((e) => e.badge === key)?.earned;

describe("badge definitions", () => {
  it("has ten families with unique keys, names, icons and display order", () => {
    expect(BADGES).toHaveLength(10);
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(10);
    expect(new Set(BADGES.map((b) => b.order)).size).toBe(10);
    expect(BADGES.map((b) => b.key)).toEqual([...BADGE_KEYS]);
    for (const b of BADGES) {
      expect(b.name.length).toBeGreaterThan(2);
      expect(b.rule.length).toBeGreaterThan(10);
      expect(b.summary.length).toBeGreaterThan(5);
    }
  });
  it("keeps Trusted reporter private and every other badge public", () => {
    expect(BADGES.filter((b) => !b.public).map((b) => b.key)).toEqual(["TRUSTED_REPORTER"]);
  });
  it("earns nothing from no activity", () => {
    expect(evaluateBadges(EMPTY_BADGE_STATS).every((e) => e.earned === 0)).toBe(true);
  });
});

describe("thresholds", () => {
  it("First room host needs one completed room", () => {
    expect(earned(stats({ completedRoomsHosted: 0 }), "FIRST_ROOM_HOST")).toBe(0);
    expect(earned(stats({ completedRoomsHosted: 1 }), "FIRST_ROOM_HOST")).toBe(1);
    expect(earned(stats({ completedRoomsHosted: 40 }), "FIRST_ROOM_HOST")).toBe(1);
  });
  it("Room host is earned again for every five rooms", () => {
    expect(earned(stats({ completedRoomsHosted: 4 }), "ROOM_HOST")).toBe(0);
    expect(earned(stats({ completedRoomsHosted: 5 }), "ROOM_HOST")).toBe(1);
    expect(earned(stats({ completedRoomsHosted: 14 }), "ROOM_HOST")).toBe(2);
    expect(earned(stats({ completedRoomsHosted: 25 }), "ROOM_HOST")).toBe(5);
  });
  it("Helpful host needs ten rooms and no open report", () => {
    expect(earned(stats({ completedRoomsHosted: 9 }), "HELPFUL_HOST")).toBe(0);
    expect(earned(stats({ completedRoomsHosted: 10 }), "HELPFUL_HOST")).toBe(1);
    expect(earned(stats({ completedRoomsHosted: 20 }), "HELPFUL_HOST")).toBe(2);
    expect(earned(stats({ completedRoomsHosted: 20, openReportsAgainst: 1 }), "HELPFUL_HOST")).toBe(
      0,
    );
  });
  it("Regular attendee, Good listener, Topic explorer and Consistent gist use steps of five", () => {
    expect(earned(stats({ roomsAttended: 5 }), "REGULAR_ATTENDEE")).toBe(1);
    expect(earned(stats({ roomsStayed: 9 }), "GOOD_LISTENER")).toBe(1);
    expect(earned(stats({ distinctTopics: 5 }), "TOPIC_EXPLORER")).toBe(1);
    expect(earned(stats({ distinctTopics: 4 }), "TOPIC_EXPLORER")).toBe(0);
    expect(earned(stats({ activeDays: 12 }), "CONSISTENT_GIST")).toBe(2);
  });
  it("Conversation starter and Community builder use steps of ten", () => {
    expect(earned(stats({ meaningfulPlaces: 9 }), "CONVERSATION_STARTER")).toBe(0);
    expect(earned(stats({ meaningfulPlaces: 10 }), "CONVERSATION_STARTER")).toBe(1);
    expect(earned(stats({ friends: 10 }), "COMMUNITY_BUILDER")).toBe(1);
    expect(earned(stats({ friends: 31 }), "COMMUNITY_BUILDER")).toBe(3);
  });
  it("Trusted reporter starts with one resolved report and repeats every five more", () => {
    expect(earned(stats({ actionableReports: 0 }), "TRUSTED_REPORTER")).toBe(0);
    expect(earned(stats({ actionableReports: 1 }), "TRUSTED_REPORTER")).toBe(1);
    expect(earned(stats({ actionableReports: 5 }), "TRUSTED_REPORTER")).toBe(2);
  });
  it("never returns a negative or fractional count, even for bad input", () => {
    const bad = stats({ completedRoomsHosted: -3, friends: 12.9, activeDays: Number.NaN });
    for (const e of evaluateBadges(bad)) {
      expect(Number.isInteger(e.earned)).toBe(true);
      expect(e.earned).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("grants are idempotent and never repeat", () => {
  it("grants only the ordinals not held yet", () => {
    const s = stats({ completedRoomsHosted: 12 });
    const first = missingGrants(s, []);
    expect(first).toContainEqual({ badge: "FIRST_ROOM_HOST", ordinal: 1 });
    expect(first.filter((g) => g.badge === "ROOM_HOST").map((g) => g.ordinal)).toEqual([1, 2]);
    const again = missingGrants(s, first);
    expect(again).toEqual([]);
  });
  it("grants the next ordinal when the count rises", () => {
    const held = [{ badge: "ROOM_HOST", ordinal: 1 }];
    const next = missingGrants(stats({ completedRoomsHosted: 10 }), held);
    expect(next.filter((g) => g.badge === "ROOM_HOST")).toEqual([
      { badge: "ROOM_HOST", ordinal: 2 },
    ]);
  });
  it("does not grant a revoked ordinal again", () => {
    // A revoked grant is still held as a row, so the ordinal stays used.
    const held = [{ badge: "FIRST_ROOM_HOST", ordinal: 1 }];
    expect(missingGrants(stats({ completedRoomsHosted: 3 }), held)).toEqual([]);
  });
});

describe("what is shown", () => {
  const grants = [
    { badge: "ROOM_HOST", revokedAt: null },
    { badge: "ROOM_HOST", revokedAt: null },
    { badge: "FIRST_ROOM_HOST", revokedAt: null },
    { badge: "TRUSTED_REPORTER", revokedAt: null },
    { badge: "GOOD_LISTENER", revokedAt: new Date() },
  ];
  it("groups active grants into counts in display order and leaves out revoked ones", () => {
    expect(summarizeBadges(grants).map((c) => [c.badge, c.count])).toEqual([
      ["FIRST_ROOM_HOST", 1],
      ["ROOM_HOST", 2],
      ["TRUSTED_REPORTER", 1],
    ]);
  });
  it("leaves private badges out of the public summary and caps it", () => {
    const pub = summarizeBadges(grants, { publicOnly: true });
    expect(pub.map((c) => c.badge)).toEqual(["FIRST_ROOM_HOST", "ROOM_HOST"]);
    expect(summarizeBadges(grants, { publicOnly: true, limit: 1 })).toHaveLength(1);
  });
  it("writes x2 for repeats, nothing for one, and a full accessible name", () => {
    expect(badgeCountLabel(1)).toBe("");
    expect(badgeCountLabel(2)).toBe("x2");
    expect(badgeCountLabel(5)).toBe("x5");
    expect(badgeAccessibleName("Room host", 2)).toBe("Room host, earned 2 times");
    expect(badgeAccessibleName("Room host", 1)).toBe("Room host");
  });
  it("reads the summary back from JSON and drops private, unknown and malformed entries", () => {
    const parsed = parseBadgeChips([
      { badge: "ROOM_HOST", count: 3 },
      { badge: "TRUSTED_REPORTER", count: 1 },
      { badge: "MADE_UP", count: 2 },
      { badge: "GOOD_LISTENER", count: 0 },
      "nope",
      null,
    ]);
    expect(parsed).toEqual([{ badge: "ROOM_HOST", count: 3 }]);
    expect(parseBadgeChips("not an array")).toEqual([]);
  });
});
