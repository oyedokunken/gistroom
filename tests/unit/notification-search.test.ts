import { describe, expect, it } from "vitest";
import {
  LIMITS,
  NOTIFICATION_TYPES,
  isSearchable,
  normalizeSearch,
  notificationListQuerySchema,
  typesMatchingSearch,
} from "@gistroom/shared";
import { isListCursor, notificationWhere } from "../../apps/web/src/server/notifications/list";

const parse = (input: Record<string, string>) => notificationListQuerySchema.parse(input);
const now = new Date("2026-11-11T10:00:00.000Z");

describe("normalizeSearch", () => {
  it("trims and collapses white space", () => {
    expect(normalizeSearch("  missed   call \n")).toBe("missed call");
  });
  it("caps the length", () => {
    const out = normalizeSearch("a".repeat(200));
    expect(out).toHaveLength(LIMITS.NOTIFICATION_SEARCH_MAX_CHARS);
  });
  it("returns an empty string for nothing", () => {
    expect(normalizeSearch(null)).toBe("");
    expect(normalizeSearch("   ")).toBe("");
  });
  it("needs two characters to count as a search", () => {
    expect(isSearchable("a")).toBe(false);
    expect(isSearchable(" a ")).toBe(false);
    expect(isSearchable("ad")).toBe(true);
  });
});

describe("typesMatchingSearch", () => {
  it("maps human labels to types", () => {
    expect(typesMatchingSearch("missed call")).toContain("CALL_MISSED");
    expect(typesMatchingSearch("Friend Request")).toContain("FRIEND_REQUEST_RECEIVED");
    expect(typesMatchingSearch("live")).toContain("ROOM_LIVE_NOW");
  });
  it("never returns the activity type or anything for a short text", () => {
    expect(typesMatchingSearch("a")).toEqual([]);
    for (const q of ["activity", "call", "room", "message"]) {
      expect(typesMatchingSearch(q)).not.toContain("ACTIVITY");
    }
  });
  it("only returns known types", () => {
    const all = new Set<string>([...NOTIFICATION_TYPES, "ROOM_DUE_HOST"]);
    for (const t of typesMatchingSearch("room"))
      expect(all.has(t) || t.startsWith("ROOM_")).toBe(true);
  });
});

describe("notificationListQuerySchema", () => {
  it("defaults to the all tab and the default page size", () => {
    const q = parse({});
    expect(q).toMatchObject({ tab: "all", unreadOnly: false, q: null, cursor: null });
    expect(q.limit).toBe(LIMITS.PAGE_SIZE_DEFAULT);
  });
  it("clamps nothing silently: a limit over 50 is refused", () => {
    expect(() => parse({ limit: "51" })).toThrow();
    expect(() => parse({ limit: "0" })).toThrow();
  });
  it("refuses a one character search and accepts two", () => {
    expect(() => parse({ q: "a" })).toThrow();
    expect(parse({ q: "  ad  " }).q).toBe("ad");
  });
  it("treats a blank search as no search", () => {
    expect(parse({ q: "   " }).q).toBeNull();
  });
  it("ignores an offset style parameter", () => {
    expect(parse({ page: "3", offset: "40" })).not.toHaveProperty("offset");
  });
});

describe("cursor boundaries", () => {
  it("accepts a well formed cursor only", () => {
    expect(isListCursor({ t: "2026-11-11T10:00:00.000Z", id: "abc" })).toBe(true);
    expect(isListCursor({ t: "not a date", id: "abc" })).toBe(false);
    expect(isListCursor({ t: "2026-11-11T10:00:00.000Z" })).toBe(false);
    expect(isListCursor(null)).toBe(false);
  });
  it("pages strictly before the cursor on the same ordering", () => {
    const where = notificationWhere(
      "u1",
      parse({}),
      { t: "2026-11-10T00:00:00.000Z", id: "n5" },
      now,
    );
    expect(JSON.stringify(where)).toContain('"createdAt":{"lt":"2026-11-10T00:00:00.000Z"}');
    expect(JSON.stringify(where)).toContain('"id":{"lt":"n5"}');
  });
});

describe("authorization shape", () => {
  it("always scopes to the signed in person, with or without a search", () => {
    for (const input of [
      {},
      { q: "ada" },
      { q: "missed call", unread: "1" },
      { tab: "activity", q: "room" },
    ]) {
      const where = notificationWhere("user_me", parse(input), null, now);
      expect(where.userId).toBe("user_me");
      // The id is never placed inside an OR branch, where it could be bypassed.
      expect(JSON.stringify(where.AND)).not.toContain("user_me");
    }
  });
  it("matches only the whitelisted payload keys, case insensitively", () => {
    const where = notificationWhere("u", parse({ q: "Ada" }), null, now);
    const text = JSON.stringify(where);
    expect(text).toContain('"path":["fromName"]');
    expect(text).toContain('"mode":"insensitive"');
    expect(text).not.toContain('"path":["conversationId"]');
    expect(text).not.toContain('"path":["roomSlug"]');
  });
  it("keeps activity out of the all tab and everything else out of the activity tab", () => {
    expect(JSON.stringify(notificationWhere("u", parse({ q: "ad" }), null, now))).toContain(
      '{"type":{"not":"ACTIVITY"}}',
    );
    const activity = JSON.stringify(
      notificationWhere("u", parse({ tab: "activity", q: "ad" }), null, now),
    );
    expect(activity).toContain('"type":"ACTIVITY"');
    expect(activity).toContain('"path":["text"]');
    expect(activity).not.toContain('"fromName"');
  });
});
