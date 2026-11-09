import { describe, expect, it } from "vitest";
import {
  attendanceLabel,
  countdownText,
  publicRoomsQuerySchema,
  rankRelated,
  roomCardAction,
  sortRoomCards,
  type RelatedCandidate,
} from "../../packages/shared/src";

const NOW = new Date("2026-11-10T10:00:00Z");
const at = (mins: number) => new Date(NOW.getTime() + mins * 60_000).toISOString();

const card = (over: Partial<Parameters<typeof sortRoomCards>[0][number]> & { slug: string }) => ({
  title: over.slug,
  status: "LIVE" as const,
  listeners: 0,
  startedAt: null as string | null,
  scheduledFor: null as string | null,
  ...over,
});

describe("sorting rooms", () => {
  it("puts live rooms first, busiest first, then upcoming rooms soonest first", () => {
    const sorted = sortRoomCards([
      card({ slug: "later", status: "SCHEDULED", scheduledFor: at(300) }),
      card({ slug: "quiet", listeners: 1, startedAt: at(-30) }),
      card({ slug: "soon", status: "SCHEDULED", scheduledFor: at(20) }),
      card({ slug: "busy", listeners: 9, startedAt: at(-10) }),
    ]);
    expect(sorted.map((c) => c.slug)).toEqual(["busy", "quiet", "soon", "later"]);
  });
  it("sorts live rooms by newest start when asked", () => {
    const sorted = sortRoomCards(
      [
        card({ slug: "old", listeners: 9, startedAt: at(-60) }),
        card({ slug: "new", listeners: 1, startedAt: at(-5) }),
      ],
      "newest",
    );
    expect(sorted.map((c) => c.slug)).toEqual(["new", "old"]);
  });
  it("is stable for rooms that tie", () => {
    const a = sortRoomCards([card({ slug: "b" }), card({ slug: "a" })]);
    const b = sortRoomCards([card({ slug: "a" }), card({ slug: "b" })]);
    expect(a.map((c) => c.slug)).toEqual(b.map((c) => c.slug));
  });
});

describe("attendance wording", () => {
  it("says in room, attending or attended", () => {
    expect(attendanceLabel("LIVE", 2)).toBe("2 in room");
    expect(attendanceLabel("SCHEDULED", 2)).toBe("2 attending");
    expect(attendanceLabel("ENDED", 2)).toBe("2 attended");
  });
  it("never shows a negative or fractional count", () => {
    expect(attendanceLabel("LIVE", -3)).toBe("0 in room");
    expect(attendanceLabel("LIVE", 2.9)).toBe("2 in room");
  });
});

describe("countdown text", () => {
  it("reads like the card: days and hours, hours and minutes, minutes", () => {
    expect(countdownText(at(26 * 60), NOW)).toBe("1 day 2h");
    expect(countdownText(at(3 * 60 + 20), NOW)).toBe("3h 20m");
    expect(countdownText(at(12), NOW)).toBe("12m");
    expect(countdownText(at(2 * 1440 + 5), NOW)).toBe("2 days");
    expect(countdownText(at(5 * 60), NOW)).toBe("5h");
  });
  it("is the same whatever time zone the viewer is in, because it is a gap between instants", () => {
    expect(countdownText(new Date(at(90)), NOW)).toBe("1h 30m");
  });
  it("says now once the time has come, and falls back to null without a usable time", () => {
    expect(countdownText(at(-1), NOW)).toBe("now");
    expect(countdownText(null, NOW)).toBeNull();
    expect(countdownText("not a date", NOW)).toBeNull();
  });
  it("says under a minute for the last seconds", () => {
    expect(countdownText(new Date(NOW.getTime() + 20_000), NOW)).toBe("under a minute");
  });
});

describe("the action on a room card", () => {
  const base = { status: "SCHEDULED" as const, scheduledFor: at(120), now: NOW };
  it("asks a signed out visitor to sign in for a live room and shows a countdown for an upcoming one", () => {
    expect(roomCardAction({ ...base, status: "LIVE", signedIn: false, isHost: false })).toBe(
      "SIGN_IN",
    );
    expect(roomCardAction({ ...base, signedIn: false, isHost: false })).toBe("COUNTDOWN");
  });
  it("lets a signed in person join a live room", () => {
    expect(roomCardAction({ ...base, status: "LIVE", signedIn: true, isHost: false })).toBe("JOIN");
  });
  it("shows Start room to the host only once the room is ready", () => {
    expect(roomCardAction({ ...base, signedIn: true, isHost: true })).toBe("COUNTDOWN");
    expect(roomCardAction({ ...base, scheduledFor: at(10), signedIn: true, isHost: true })).toBe(
      "START",
    );
    expect(roomCardAction({ ...base, scheduledFor: at(-5), signedIn: true, isHost: true })).toBe(
      "START",
    );
  });
  it("never offers Start to someone who is not the host", () => {
    expect(roomCardAction({ ...base, scheduledFor: at(1), signedIn: true, isHost: false })).toBe(
      "COUNTDOWN",
    );
  });
  it("does not offer Join for a live room that is full for this viewer", () => {
    expect(
      roomCardAction({ ...base, status: "LIVE", signedIn: true, isHost: false, canJoin: false }),
    ).toBe("COUNTDOWN");
  });
});

describe("related rooms", () => {
  const target = {
    slug: "t",
    topicSlug: "football",
    language: "ENGLISH" as const,
    scheduledFor: at(60),
  };
  const cand = (over: Partial<RelatedCandidate> & { slug: string }): RelatedCandidate => ({
    status: "LIVE",
    visibility: "PUBLIC",
    topicSlug: null,
    language: "OTHER",
    scheduledFor: null,
    listeners: 0,
    accessible: true,
    ...over,
  });

  it("ranks the same topic first, then language, then live before upcoming, then closeness", () => {
    const ranked = rankRelated(
      target,
      [
        cand({ slug: "lang-only", language: "ENGLISH" }),
        cand({ slug: "nothing" }),
        cand({
          slug: "topic-upcoming",
          topicSlug: "football",
          status: "SCHEDULED",
          scheduledFor: at(90),
        }),
        cand({ slug: "topic-live", topicSlug: "football", language: "YORUBA" }),
        cand({
          slug: "topic-lang",
          topicSlug: "football",
          language: "ENGLISH",
          status: "SCHEDULED",
          scheduledFor: at(500),
        }),
      ],
      NOW,
    );
    expect(ranked.map((r) => r.slug)).toEqual([
      "topic-lang",
      "topic-live",
      "topic-upcoming",
      "lang-only",
      "nothing",
    ]);
  });
  it("breaks ties by the nearest start time and then the busiest live room", () => {
    const ranked = rankRelated(
      target,
      [
        cand({ slug: "far", topicSlug: "football", status: "SCHEDULED", scheduledFor: at(600) }),
        cand({ slug: "near", topicSlug: "football", status: "SCHEDULED", scheduledFor: at(70) }),
        cand({ slug: "quiet", topicSlug: "football", status: "LIVE", listeners: 1 }),
        cand({ slug: "busy", topicSlug: "football", status: "LIVE", listeners: 8 }),
      ],
      NOW,
    );
    expect(ranked.map((r) => r.slug)).toEqual(["busy", "quiet", "near", "far"]);
  });
  it("never recommends itself, an ended room, a room the viewer cannot see, or a duplicate", () => {
    const ranked = rankRelated(
      target,
      [
        cand({ slug: "t", topicSlug: "football" }),
        cand({ slug: "ended", status: "ENDED", topicSlug: "football" }),
        cand({ slug: "private", visibility: "PRIVATE", accessible: false, topicSlug: "football" }),
        cand({ slug: "ok", topicSlug: "football" }),
        cand({ slug: "ok", topicSlug: "football" }),
      ],
      NOW,
    );
    expect(ranked.map((r) => r.slug)).toEqual(["ok"]);
  });
  it("returns an empty list when nothing is related and caps long lists", () => {
    expect(rankRelated(target, [], NOW)).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) =>
      cand({ slug: `r${i}`, topicSlug: "football" }),
    );
    expect(rankRelated(target, many, NOW)).toHaveLength(6);
    expect(rankRelated(target, many, NOW, 3)).toHaveLength(3);
  });
});

describe("room list filters", () => {
  it("accepts topic, language and text and normalizes the language", () => {
    const parsed = publicRoomsQuerySchema.parse({
      q: " gist ",
      topic: "football",
      language: "yoruba",
    });
    expect(parsed).toEqual({ q: "gist", topic: "football", language: "YORUBA" });
  });
  it("drops an unknown language and empty values instead of failing", () => {
    const parsed = publicRoomsQuerySchema.parse({ q: "", topic: "", language: "klingon" });
    expect(parsed).toEqual({ q: undefined, topic: undefined, language: undefined });
  });
});
