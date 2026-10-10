import { describe, expect, it } from "vitest";
import {
  LIMITS,
  canActOn,
  canDo,
  createRoomSchema,
  inviteLinkSchema,
  joinVerdict,
  linkExpiry,
  linkState,
  nextHost,
  slugFromBytes,
  type JoinInput,
} from "../../packages/shared/src";

const now = new Date("2026-10-10T12:00:00Z");
const base: JoinInput = {
  status: "LIVE",
  visibility: "PUBLIC",
  locked: false,
  isHost: false,
  member: null,
  linkValid: false,
  joinedCount: 3,
  max: LIMITS.ROOM_MAX_PARTICIPANTS,
  now,
};
const member = (
  state: "INVITED" | "JOINED" | "LEFT" | "REMOVED" | "BANNED",
  role: "HOST" | "MODERATOR" | "MEMBER" = "MEMBER",
  graceUntil: Date | null = null,
) => ({ state, role, graceUntil });

describe("who can join a room", () => {
  it("lets anyone into a live public room", () => {
    expect(joinVerdict(base)).toEqual({ ok: true, role: "MEMBER" });
  });
  it("turns away people when the room has ended or has not started", () => {
    expect(joinVerdict({ ...base, status: "ENDED" })).toEqual({ ok: false, reason: "ENDED" });
    expect(joinVerdict({ ...base, status: "SCHEDULED" })).toEqual({
      ok: false,
      reason: "NOT_STARTED",
    });
    expect(joinVerdict({ ...base, status: "SCHEDULED", isHost: true }).ok).toBe(true);
  });
  it("keeps banned people out of every room", () => {
    expect(joinVerdict({ ...base, member: member("BANNED") })).toEqual({
      ok: false,
      reason: "BANNED",
    });
    expect(
      joinVerdict({ ...base, visibility: "PRIVATE", linkValid: true, member: member("BANNED") }).ok,
    ).toBe(false);
  });
  it("lets only invited people into a private room", () => {
    const priv = { ...base, visibility: "PRIVATE" as const };
    expect(joinVerdict(priv)).toEqual({ ok: false, reason: "NOT_INVITED" });
    expect(joinVerdict({ ...priv, member: member("INVITED") }).ok).toBe(true);
    expect(joinVerdict({ ...priv, member: member("JOINED") }).ok).toBe(true);
    expect(joinVerdict({ ...priv, member: member("REMOVED") })).toEqual({
      ok: false,
      reason: "NOT_INVITED",
    });
    expect(joinVerdict({ ...priv, isHost: true }).ok).toBe(true);
  });
  it("lets a valid invite link in, and nothing else about a bad link", () => {
    const priv = { ...base, visibility: "PRIVATE" as const };
    expect(joinVerdict({ ...priv, linkValid: true }).ok).toBe(true);
    expect(joinVerdict({ ...priv, linkValid: false })).toEqual({
      ok: false,
      reason: "NOT_INVITED",
    });
  });
  it("says the room is full at the limit, but never for someone already in", () => {
    const full = { ...base, joinedCount: LIMITS.ROOM_MAX_PARTICIPANTS };
    expect(joinVerdict(full)).toEqual({ ok: false, reason: "FULL" });
    expect(joinVerdict({ ...full, member: member("JOINED") }).ok).toBe(true);
    expect(joinVerdict({ ...full, isHost: true }).ok).toBe(true);
  });
  it("locks out newcomers but not moderators or people already in", () => {
    const locked = { ...base, locked: true };
    expect(joinVerdict(locked)).toEqual({ ok: false, reason: "LOCKED" });
    expect(joinVerdict({ ...locked, member: member("JOINED", "MODERATOR") }).ok).toBe(true);
    expect(joinVerdict({ ...locked, member: member("JOINED") }).ok).toBe(true);
  });
  it("gives a dropped person 120 seconds to take their seat back, even when full or locked", () => {
    const drop = {
      ...base,
      locked: true,
      joinedCount: LIMITS.ROOM_MAX_PARTICIPANTS,
    };
    const grace = new Date(now.getTime() + 60_000);
    expect(joinVerdict({ ...drop, member: member("LEFT", "MEMBER", grace) }).ok).toBe(true);
    const past = new Date(now.getTime() - 1000);
    expect(joinVerdict({ ...drop, member: member("LEFT", "MEMBER", past) }).ok).toBe(false);
  });
  it("keeps the role of a returning moderator", () => {
    expect(joinVerdict({ ...base, member: member("LEFT", "MODERATOR") })).toEqual({
      ok: true,
      role: "MODERATOR",
    });
  });
});

describe("room permissions", () => {
  it("gives the host everything and members nothing", () => {
    for (const a of [
      "MUTE",
      "REMOVE",
      "BAN",
      "LOCK",
      "DEMOTE",
      "TRANSFER",
      "END",
      "SEE_LOG",
    ] as const) {
      expect(canDo("HOST", a)).toBe(true);
      expect(canDo("MEMBER", a)).toBe(false);
      expect(canDo(null, a)).toBe(false);
    }
  });
  it("lets moderators moderate and invite moderators, but not demote, transfer, end or read the log", () => {
    for (const a of [
      "MUTE",
      "MUTE_ALL",
      "REMOVE",
      "BAN",
      "LOCK",
      "DELETE_MESSAGE",
      "INVITE",
      "LINK",
      "PROMOTE",
    ] as const) {
      expect(canDo("MODERATOR", a)).toBe(true);
    }
    for (const a of ["DEMOTE", "TRANSFER", "END", "SEE_LOG"] as const) {
      expect(canDo("MODERATOR", a)).toBe(false);
    }
  });
  it("never lets anyone act on the host, and keeps moderators to members", () => {
    expect(canActOn("HOST", "MODERATOR")).toBe(true);
    expect(canActOn("HOST", "MEMBER")).toBe(true);
    expect(canActOn("HOST", "HOST")).toBe(false);
    expect(canActOn("MODERATOR", "MEMBER")).toBe(true);
    expect(canActOn("MODERATOR", "MODERATOR")).toBe(false);
    expect(canActOn("MODERATOR", "HOST")).toBe(false);
    expect(canActOn("MEMBER", "MEMBER")).toBe(false);
  });
});

describe("host transfer", () => {
  const at = (m: number) => new Date(now.getTime() + m * 60_000);
  it("picks the longest serving moderator", () => {
    expect(
      nextHost(
        [
          { userId: "h", role: "HOST", joinedAt: at(0) },
          { userId: "m1", role: "MEMBER", joinedAt: at(1) },
          { userId: "mod2", role: "MODERATOR", joinedAt: at(5) },
          { userId: "mod1", role: "MODERATOR", joinedAt: at(3) },
        ],
        "h",
      ),
    ).toBe("mod1");
  });
  it("falls back to the longest present member and ends with null when nobody is left", () => {
    expect(
      nextHost(
        [
          { userId: "h", role: "HOST", joinedAt: at(0) },
          { userId: "b", role: "MEMBER", joinedAt: at(4) },
          { userId: "a", role: "MEMBER", joinedAt: at(2) },
          { userId: "gone", role: "MEMBER", joinedAt: null },
        ],
        "h",
      ),
    ).toBe("a");
    expect(nextHost([{ userId: "h", role: "HOST", joinedAt: at(0) }], "h")).toBeNull();
  });
});

describe("invite links", () => {
  const link = {
    expiresAt: new Date(now.getTime() + 3_600_000),
    revokedAt: null,
    maxUses: null as number | null,
    usedCount: 0,
    now,
  };
  it("is fine until it expires, is revoked or runs out of uses", () => {
    expect(linkState(link)).toBe("OK");
    expect(linkState({ ...link, expiresAt: now })).toBe("EXPIRED");
    expect(linkState({ ...link, revokedAt: now })).toBe("REVOKED");
    expect(linkState({ ...link, maxUses: 2, usedCount: 2 })).toBe("USED_UP");
    expect(linkState({ ...link, maxUses: 2, usedCount: 1 })).toBe("OK");
  });
  it("only offers 1 hour, 24 hours or 7 days", () => {
    expect(inviteLinkSchema.parse({ hours: 168 }).hours).toBe(168);
    expect(inviteLinkSchema.safeParse({ hours: 5 }).success).toBe(false);
    expect(inviteLinkSchema.parse({}).hours).toBe(24);
    expect(linkExpiry(24, now).getTime() - now.getTime()).toBe(86_400_000);
  });
});

describe("creating a room", () => {
  it("needs a title of at most 80 characters", () => {
    expect(createRoomSchema.safeParse({ title: "" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ title: "x".repeat(81) }).success).toBe(false);
    const ok = createRoomSchema.parse({ title: "Jollof or no jollof" });
    expect(ok).toMatchObject({ language: "ENGLISH", visibility: "PUBLIC" });
  });
  it("makes slugs from random bytes without look alike characters", () => {
    const slug = slugFromBytes(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(slug).toHaveLength(10);
    expect(slug).toMatch(/^[a-z2-9]+$/);
    expect(slug).not.toMatch(/[ilo01]/);
  });
});

describe("room limits", () => {
  it("keeps video publishers within the room cap", () => {
    expect(LIMITS.ROOM_MAX_VIDEO_PUBLISHERS).toBeLessThanOrEqual(LIMITS.ROOM_MAX_PARTICIPANTS);
  });
});
