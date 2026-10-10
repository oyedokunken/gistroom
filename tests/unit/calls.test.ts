import { describe, expect, it } from "vitest";
import {
  applyCallAction,
  durationSec,
  isFinished,
  liveKitRoomName,
  logOutcomeFor,
  resolveGlare,
  ringExpiry,
} from "../../packages/shared/src";

const t0 = new Date("2026-10-10T10:00:00Z");
const ctx = (over: Partial<{ isCaller: boolean; now: Date }> = {}) => ({
  isCaller: false,
  now: new Date(t0.getTime() + 5000),
  ringExpiresAt: ringExpiry(t0),
  ...over,
});

describe("call state machine", () => {
  it("rings for 45 seconds", () => {
    expect(ringExpiry(t0).getTime() - t0.getTime()).toBe(45_000);
  });
  it("lets the callee answer or decline while it rings", () => {
    expect(applyCallAction("RINGING", "ACCEPT", ctx())).toEqual({ ok: true, next: "ACTIVE" });
    expect(applyCallAction("RINGING", "DECLINE", ctx())).toEqual({ ok: true, next: "DECLINED" });
  });
  it("lets only the caller cancel, and never lets the caller answer their own call", () => {
    expect(applyCallAction("RINGING", "CANCEL", ctx({ isCaller: true }))).toEqual({
      ok: true,
      next: "CANCELLED",
    });
    expect(applyCallAction("RINGING", "CANCEL", ctx()).ok).toBe(false);
    expect(applyCallAction("RINGING", "ACCEPT", ctx({ isCaller: true })).ok).toBe(false);
    expect(applyCallAction("RINGING", "DECLINE", ctx({ isCaller: true })).ok).toBe(false);
  });
  it("turns a late answer into a missed call", () => {
    const late = ctx({ now: new Date(t0.getTime() + 46_000) });
    expect(applyCallAction("RINGING", "ACCEPT", late)).toEqual({ ok: true, next: "MISSED" });
  });
  it("times out only once the ring is over", () => {
    expect(applyCallAction("RINGING", "TIMEOUT", ctx()).ok).toBe(false);
    const late = ctx({ now: new Date(t0.getTime() + 45_000) });
    expect(applyCallAction("RINGING", "TIMEOUT", late)).toEqual({ ok: true, next: "MISSED" });
  });
  it("ends an active call for either person and nothing moves after that", () => {
    expect(applyCallAction("ACTIVE", "END", ctx())).toEqual({ ok: true, next: "ENDED" });
    expect(applyCallAction("ACTIVE", "END", ctx({ isCaller: true }))).toEqual({
      ok: true,
      next: "ENDED",
    });
    for (const done of ["ENDED", "MISSED", "DECLINED", "CANCELLED", "BUSY", "FAILED"] as const) {
      expect(applyCallAction(done, "END", ctx()).ok).toBe(false);
      expect(applyCallAction(done, "ACCEPT", ctx()).ok).toBe(false);
      expect(isFinished(done)).toBe(true);
    }
    expect(isFinished("RINGING")).toBe(false);
    expect(isFinished("ACTIVE")).toBe(false);
  });
});

describe("glare", () => {
  const ringing = { id: "c1", callerId: "b", calleeId: "a", status: "RINGING" as const };
  it("merges when the person being called calls back", () => {
    expect(resolveGlare(ringing, "a", "b")).toBe("c1");
  });
  it("does not merge unrelated or finished calls", () => {
    expect(resolveGlare(null, "a", "b")).toBeNull();
    expect(resolveGlare({ ...ringing, status: "ACTIVE" }, "a", "b")).toBeNull();
    expect(resolveGlare(ringing, "a", "c")).toBeNull();
    expect(resolveGlare({ ...ringing, callerId: "a", calleeId: "b" }, "a", "b")).toBeNull();
  });
});

describe("call log helpers", () => {
  it("maps statuses to what each person reads", () => {
    expect(logOutcomeFor("ENDED", t0)).toBe("ANSWERED");
    expect(logOutcomeFor("MISSED", null)).toBe("MISSED");
    expect(logOutcomeFor("DECLINED", null)).toBe("DECLINED");
    expect(logOutcomeFor("CANCELLED", null)).toBe("CANCELLED");
    expect(logOutcomeFor("BUSY", null)).toBe("BUSY");
    expect(logOutcomeFor("RINGING", null)).toBeNull();
  });
  it("measures talk time from the answer", () => {
    expect(durationSec(t0, new Date(t0.getTime() + 61_400))).toBe(61);
    expect(durationSec(null, t0)).toBe(0);
  });
  it("names the LiveKit room from the call id", () => {
    expect(liveKitRoomName("abc")).toBe("call_abc");
  });
});
