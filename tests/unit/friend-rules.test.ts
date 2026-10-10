import { describe, expect, it } from "vitest";
import {
  activeCooldown,
  canInteract,
  decideSend,
  retryAfter,
  type SendInputs,
} from "../../apps/web/src/server/friends/rules";

const now = new Date("2026-10-10T10:00:00Z");
const base: SendInputs = {
  selfId: "a",
  targetId: "b",
  blocked: false,
  isFriend: false,
  sentPendingId: null,
  receivedPendingId: null,
  cooldownUntil: null,
  targetActive: true,
  now,
};

describe("decideSend", () => {
  it("sends a normal request", () => {
    expect(decideSend(base)).toEqual({ action: "SEND" });
  });
  it("refuses yourself", () => {
    expect(decideSend({ ...base, targetId: "a" })).toEqual({ action: "REFUSE", reason: "SELF" });
  });
  it("gives blocked, deleted and inactive people the same unavailable answer", () => {
    const blocked = decideSend({ ...base, blocked: true });
    const gone = decideSend({ ...base, targetActive: false });
    expect(blocked).toEqual({ action: "REFUSE", reason: "UNAVAILABLE" });
    expect(gone).toEqual(blocked);
  });
  it("is idempotent for friends and for a pending request", () => {
    expect(decideSend({ ...base, isFriend: true })).toEqual({ action: "ALREADY_FRIENDS" });
    expect(decideSend({ ...base, sentPendingId: "r1" })).toEqual({ action: "ALREADY_SENT" });
  });
  it("accepts automatically when they already asked me (simultaneous requests)", () => {
    expect(decideSend({ ...base, receivedPendingId: "r9" })).toEqual({
      action: "AUTO_ACCEPT",
      requestId: "r9",
    });
    expect(decideSend({ ...base, receivedPendingId: "r9", sentPendingId: "r1" }).action).toBe(
      "AUTO_ACCEPT",
    );
  });
  it("hides a rejection behind the same unavailable answer until the cooldown ends", () => {
    const until = new Date(now.getTime() + 3 * 86_400_000);
    expect(decideSend({ ...base, cooldownUntil: until })).toEqual({
      action: "REFUSE",
      reason: "UNAVAILABLE",
    });
    expect(decideSend({ ...base, cooldownUntil: new Date(now.getTime() - 1) })).toEqual({
      action: "SEND",
    });
  });
  it("lets a block beat an existing friendship", () => {
    expect(decideSend({ ...base, isFriend: true, blocked: true }).action).toBe("REFUSE");
  });
});

describe("cooldown", () => {
  it("is seven days", () => {
    expect(retryAfter(now).getTime() - now.getTime()).toBe(7 * 86_400_000);
  });
  it("picks the latest active one", () => {
    const soon = new Date(now.getTime() + 86_400_000);
    const later = new Date(now.getTime() + 5 * 86_400_000);
    const past = new Date(now.getTime() - 1000);
    expect(
      activeCooldown([{ retryAfter: soon }, { retryAfter: later }, { retryAfter: past }], now),
    ).toEqual(later);
    expect(activeCooldown([{ retryAfter: past }, { retryAfter: null }], now)).toBeNull();
  });
});

describe("canInteract", () => {
  it("needs a friendship and no block", () => {
    expect(canInteract({ isFriend: true, blocked: false })).toBe(true);
    expect(canInteract({ isFriend: false, blocked: false })).toBe(false);
    expect(canInteract({ isFriend: true, blocked: true })).toBe(false);
  });
});
