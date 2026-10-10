import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { LIMITS } from "@gistroom/shared";

/** A fresh numeric code with leading zeros kept. Uses a CSPRNG, never Math.random. */
export function generateOtp(length: number = LIMITS.OTP_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i += 1) code += String(randomInt(0, 10));
  return code;
}

/** HMAC of the code, bound to the email and purpose, so a leaked row cannot be brute forced offline. */
export function hashOtp(code: string, email: string, pepper: string, purpose = "SIGN_IN"): string {
  return createHmac("sha256", pepper)
    .update(`otp:${purpose}:${email.toLowerCase()}:${code}`)
    .digest("hex");
}

/** Stable lookup key for challenges. The raw email is never stored on the challenge row. */
export function hashEmail(email: string, pepper: string): string {
  return createHmac("sha256", pepper).update(`email:${email.toLowerCase()}`).digest("hex");
}

export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface ChallengeState {
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  lockedUntil: Date | null;
  lastSentAt: Date;
}

export type VerifyOutcome =
  | { status: "OK" }
  | { status: "WRONG"; attemptsLeft: number }
  | { status: "LOCKED"; retryAfterSec: number }
  | { status: "EXPIRED" }
  | { status: "USED" };

/** Pure decision for one verify attempt. The caller persists attempts, lock and consumption. */
export function evaluateVerify(c: ChallengeState, submittedHash: string, now: Date): VerifyOutcome {
  if (c.consumedAt) return { status: "USED" };
  if (c.lockedUntil && c.lockedUntil > now) {
    return {
      status: "LOCKED",
      retryAfterSec: Math.ceil((c.lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }
  if (c.expiresAt <= now) return { status: "EXPIRED" };
  if (hashesEqual(c.codeHash, submittedHash)) return { status: "OK" };
  const used = c.attempts + 1;
  if (used >= LIMITS.OTP_MAX_ATTEMPTS) {
    return { status: "LOCKED", retryAfterSec: OTP_LOCK_MIN * 60 };
  }
  return { status: "WRONG", attemptsLeft: LIMITS.OTP_MAX_ATTEMPTS - used };
}

export const OTP_LOCK_MIN = 15;

export function lockUntil(now: Date): Date {
  return new Date(now.getTime() + OTP_LOCK_MIN * 60_000);
}

export function otpExpiry(now: Date): Date {
  return new Date(now.getTime() + LIMITS.OTP_TTL_MIN * 60_000);
}

export type SendDecision =
  | { allowed: true }
  | { allowed: false; reason: "COOLDOWN"; retryAfterSec: number }
  | { allowed: false; reason: "HOURLY"; retryAfterSec: number };

/**
 * Decide whether another code may be sent. `recentSends` are the send times inside the last hour.
 * The resend cooldown is 60 seconds and the cap is 5 sends per hour per email.
 */
export function canSendOtp(recentSends: readonly Date[], now: Date): SendDecision {
  const sorted = [...recentSends].sort((a, b) => b.getTime() - a.getTime());
  const last = sorted[0];
  if (last) {
    const wait = LIMITS.OTP_RESEND_COOLDOWN_SEC - (now.getTime() - last.getTime()) / 1000;
    if (wait > 0) return { allowed: false, reason: "COOLDOWN", retryAfterSec: Math.ceil(wait) };
  }
  const inHour = sorted.filter((d) => now.getTime() - d.getTime() < 3_600_000);
  if (inHour.length >= LIMITS.OTP_SENDS_PER_HOUR) {
    const oldest = inHour[inHour.length - 1];
    const retry = oldest ? 3600 - (now.getTime() - oldest.getTime()) / 1000 : 3600;
    return { allowed: false, reason: "HOURLY", retryAfterSec: Math.ceil(retry) };
  }
  return { allowed: true };
}
