import { describe, expect, it } from "vitest";
import {
  archivedHasActivity,
  bodyIsValid,
  canDeleteForEveryone,
  isSingleEmoji,
  previewText,
  showInList,
} from "../../apps/web/src/server/chat/rules";
import { unreadCutoff } from "../../apps/web/src/server/chat/unread";

const now = new Date("2026-10-10T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe("delete for everyone", () => {
  const base = { senderId: "a", userId: "a", createdAt: ago(10), alreadyDeleted: false, now };
  it("allows the sender inside 60 minutes", () => {
    expect(canDeleteForEveryone(base)).toEqual({ ok: true });
    expect(canDeleteForEveryone({ ...base, createdAt: ago(60) })).toEqual({ ok: true });
  });
  it("refuses after the window, for others and twice", () => {
    expect(canDeleteForEveryone({ ...base, createdAt: ago(61) })).toEqual({
      ok: false,
      reason: "WINDOW_CLOSED",
    });
    expect(canDeleteForEveryone({ ...base, userId: "b" })).toEqual({
      ok: false,
      reason: "NOT_SENDER",
    });
    expect(canDeleteForEveryone({ ...base, alreadyDeleted: true })).toEqual({
      ok: false,
      reason: "ALREADY_DELETED",
    });
  });
});

describe("conversation list visibility", () => {
  it("shows chats that were never cleared", () => {
    expect(showInList({ clearedAt: null, lastMessageAt: null })).toBe(true);
  });
  it("hides a cleared chat until something newer arrives", () => {
    expect(showInList({ clearedAt: ago(5), lastMessageAt: ago(10) })).toBe(false);
    expect(showInList({ clearedAt: ago(5), lastMessageAt: null })).toBe(false);
    expect(showInList({ clearedAt: ago(5), lastMessageAt: ago(1) })).toBe(true);
  });
  it("flags archived activity without unarchiving", () => {
    expect(archivedHasActivity([0, 0, 2])).toBe(true);
    expect(archivedHasActivity([0, 0])).toBe(false);
  });
});

describe("previews", () => {
  it("describes media and never leaks deleted text", () => {
    expect(
      previewText({
        type: "TEXT",
        body: "  hello\n there ",
        deletedForEveryone: false,
        mine: false,
      }),
    ).toBe("hello there");
    expect(
      previewText({ type: "TEXT", body: "secret", deletedForEveryone: true, mine: true }),
    ).toBe("You: This message was deleted");
    expect(previewText({ type: "VOICE", body: null, deletedForEveryone: false, mine: false })).toBe(
      "Voice note",
    );
    expect(
      previewText({ type: "IMAGE", body: "caption", deletedForEveryone: false, mine: true }),
    ).toBe("You: Photo");
  });
});

describe("reactions and bodies", () => {
  it("accepts one emoji only (escapes, R1)", () => {
    expect(isSingleEmoji("\u{1F600}")).toBe(true);
    expect(isSingleEmoji("\u{1F44D}\u{1F3FD}")).toBe(true);
    expect(isSingleEmoji("\u{1F600}\u{1F600}")).toBe(false);
    expect(isSingleEmoji("a")).toBe(false);
    expect(isSingleEmoji("")).toBe(false);
  });
  it("needs text for TEXT and allows captions on media", () => {
    expect(bodyIsValid("TEXT", "  ")).toBe(false);
    expect(bodyIsValid("TEXT", "hi")).toBe(true);
    expect(bodyIsValid("IMAGE", null)).toBe(true);
    expect(bodyIsValid("TEXT", "x".repeat(4001))).toBe(false);
    expect(bodyIsValid("TEXT", "x".repeat(4000))).toBe(true);
  });
});

describe("unread cutoff", () => {
  it("takes the later of last read and cleared", () => {
    expect(unreadCutoff(null, null)).toBeNull();
    expect(unreadCutoff(ago(10), null)).toEqual(ago(10));
    expect(unreadCutoff(ago(10), ago(5))).toEqual(ago(5));
    expect(unreadCutoff(ago(2), ago(5))).toEqual(ago(2));
  });
});
