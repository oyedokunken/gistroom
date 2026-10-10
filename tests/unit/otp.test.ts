import { describe, expect, it } from "vitest";
import {
  canSendOtp,
  evaluateVerify,
  generateOtp,
  hashEmail,
  hashOtp,
  lockUntil,
  otpExpiry,
  type ChallengeState,
} from "../../apps/web/src/server/auth/otp";

const pepper = "p".repeat(40);
const now = new Date("2026-10-10T10:00:00Z");
const ago = (sec: number) => new Date(now.getTime() - sec * 1000);

function challenge(over: Partial<ChallengeState> = {}): ChallengeState {
  return {
    codeHash: hashOtp("123456", "a@example.com", pepper),
    attempts: 0,
    expiresAt: otpExpiry(now),
    consumedAt: null,
    lockedUntil: null,
    lastSentAt: now,
    ...over,
  };
}

describe("generateOtp", () => {
  it("makes six digits and keeps leading zeros", () => {
    for (let i = 0; i < 200; i += 1) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("hashing", () => {
  it("binds the code to the email and purpose", () => {
    const a = hashOtp("123456", "a@example.com", pepper);
    expect(a).toBe(hashOtp("123456", "A@Example.com", pepper));
    expect(a).not.toBe(hashOtp("123456", "b@example.com", pepper));
    expect(a).not.toBe(hashOtp("123456", "a@example.com", pepper, "DELETE_ACCOUNT"));
    expect(a).not.toBe(hashOtp("123456", "a@example.com", "q".repeat(40)));
  });
  it("hashes email lookups without exposing the address", () => {
    expect(hashEmail("a@example.com", pepper)).not.toContain("example");
  });
});

describe("evaluateVerify", () => {
  const right = hashOtp("123456", "a@example.com", pepper);
  const wrong = hashOtp("000000", "a@example.com", pepper);

  it("accepts the right code", () => {
    expect(evaluateVerify(challenge(), right, now)).toEqual({ status: "OK" });
  });
  it("counts down attempts on a wrong code", () => {
    expect(evaluateVerify(challenge(), wrong, now)).toEqual({ status: "WRONG", attemptsLeft: 4 });
    expect(evaluateVerify(challenge({ attempts: 3 }), wrong, now)).toEqual({
      status: "WRONG",
      attemptsLeft: 1,
    });
  });
  it("locks for 15 minutes on the fifth wrong code", () => {
    expect(evaluateVerify(challenge({ attempts: 4 }), wrong, now)).toEqual({
      status: "LOCKED",
      retryAfterSec: 900,
    });
    expect(lockUntil(now).getTime() - now.getTime()).toBe(900_000);
  });
  it("refuses even the right code while locked", () => {
    const r = evaluateVerify(
      challenge({ lockedUntil: new Date(now.getTime() + 60_000) }),
      right,
      now,
    );
    expect(r).toEqual({ status: "LOCKED", retryAfterSec: 60 });
  });
  it("expires after ten minutes and cannot be reused", () => {
    expect(evaluateVerify(challenge({ expiresAt: ago(1) }), right, now)).toEqual({
      status: "EXPIRED",
    });
    expect(evaluateVerify(challenge({ consumedAt: ago(5) }), right, now)).toEqual({
      status: "USED",
    });
  });
});

describe("canSendOtp", () => {
  it("allows the first send", () => {
    expect(canSendOtp([], now)).toEqual({ allowed: true });
  });
  it("enforces a 60 second cooldown", () => {
    expect(canSendOtp([ago(20)], now)).toEqual({
      allowed: false,
      reason: "COOLDOWN",
      retryAfterSec: 40,
    });
    expect(canSendOtp([ago(61)], now)).toEqual({ allowed: true });
  });
  it("enforces five sends per hour", () => {
    const five = [ago(120), ago(600), ago(1200), ago(1800), ago(3000)];
    const r = canSendOtp(five, now);
    expect(r).toMatchObject({ allowed: false, reason: "HOURLY" });
    expect(canSendOtp([...five.slice(0, 4), ago(3700)], now)).toEqual({ allowed: true });
  });
});
