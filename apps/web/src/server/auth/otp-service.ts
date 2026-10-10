import { randomBytes } from "node:crypto";
import { getDb, type OtpPurpose, type User } from "@gistroom/db";
import { LIMITS, errors } from "@gistroom/shared";
import { getEnv } from "../env";
import { AppError } from "../http";
import { enforce, policies } from "../rate-limit";
import { sendTemplate } from "../mail/send";
import {
  OTP_LOCK_MIN,
  canSendOtp,
  evaluateVerify,
  generateOtp,
  hashEmail,
  hashOtp,
  lockUntil,
  otpExpiry,
} from "./otp";

export interface RequestOtpResult {
  resendAfterSec: number;
}

export type CodeTemplate = "verify-otp" | "reset-otp" | "delete-account-otp";

/**
 * Create and email a one time code for a purpose. Codes are only used to confirm a new email at sign up,
 * to reset a password, and to confirm account deletion. They are never a sign in method.
 * A mail failure is loud (Section 19): the challenge is removed and the person is told plainly.
 */
export async function sendCode(input: {
  email: string;
  ip: string;
  purpose: OtpPurpose;
  template: CodeTemplate;
}): Promise<RequestOtpResult> {
  const { email, purpose } = input;
  const db = getDb();
  const pepper = getEnv().SESSION_SECRET;
  await enforce(policies.otpSendIp, input.ip);

  const now = new Date();
  const emailHash = hashEmail(email, pepper);
  const recent = await db.otpChallenge.findMany({
    where: { emailHash, purpose, createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
    orderBy: { createdAt: "desc" },
  });

  // A lock must survive asking for a new code, or it would be pointless.
  const lockedUntil = recent
    .map((r) => r.lockedUntil)
    .filter((d): d is Date => d !== null && d > now)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (lockedUntil) {
    const retry = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
    throw new AppError(429, "RATE_LIMITED", errors.otpLocked(Math.ceil(retry / 60)), {
      retryAfterSec: retry,
    });
  }

  const decision = canSendOtp(
    recent.map((r) => r.lastSentAt),
    now,
  );
  if (!decision.allowed) {
    const message =
      decision.reason === "COOLDOWN"
        ? errors.otpCooldown(decision.retryAfterSec)
        : errors.otpHourly(Math.ceil(decision.retryAfterSec / 60));
    throw new AppError(429, "RATE_LIMITED", message, { retryAfterSec: decision.retryAfterSec });
  }

  const code = generateOtp();
  const challenge = await db.otpChallenge.create({
    data: {
      emailHash,
      purpose,
      codeHash: hashOtp(code, email, pepper, purpose),
      expiresAt: otpExpiry(now),
      lastSentAt: now,
    },
  });
  await db.otpChallenge.updateMany({
    where: { emailHash, purpose, consumedAt: null, id: { not: challenge.id } },
    data: { consumedAt: now },
  });

  try {
    await sendTemplate(input.template, email, { code });
  } catch {
    await db.otpChallenge.delete({ where: { id: challenge.id } });
    throw new AppError(502, "MAIL_FAILED", errors.mailFailed);
  }
  return { resendAfterSec: LIMITS.OTP_RESEND_COOLDOWN_SEC };
}

/**
 * Check a code for a purpose and use it up. Throws a plain error for a wrong, expired, used or locked code.
 * Resolves when the code is good and has been consumed, so it can only work once.
 */
export async function checkCode(input: {
  email: string;
  code: string;
  ip: string;
  purpose: OtpPurpose;
}): Promise<void> {
  const { email, code, purpose } = input;
  const db = getDb();
  const pepper = getEnv().SESSION_SECRET;
  await enforce(policies.otpVerifyIp, input.ip);

  const now = new Date();
  const emailHash = hashEmail(email, pepper);
  const challenge = await db.otpChallenge.findFirst({
    where: { emailHash, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) {
    throw new AppError(400, "INVALID", errors.otpMissing, { fields: { code: errors.otpMissing } });
  }

  const outcome = evaluateVerify(
    {
      codeHash: challenge.codeHash,
      attempts: challenge.attempts,
      expiresAt: challenge.expiresAt,
      consumedAt: challenge.consumedAt,
      lockedUntil: challenge.lockedUntil,
      lastSentAt: challenge.lastSentAt,
    },
    hashOtp(code, email, pepper, purpose),
    now,
  );

  const fail = (message: string) =>
    new AppError(400, "INVALID", message, { fields: { code: message } });

  switch (outcome.status) {
    case "USED":
      throw fail(errors.otpUsed);
    case "EXPIRED":
      throw fail(errors.otpExpired);
    case "WRONG":
      await db.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw fail(errors.otpWrong(outcome.attemptsLeft));
    case "LOCKED": {
      if (!challenge.lockedUntil || challenge.lockedUntil <= now) {
        await db.otpChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 }, lockedUntil: lockUntil(now) },
        });
      }
      throw new AppError(
        429,
        "RATE_LIMITED",
        errors.otpLocked(Math.ceil(outcome.retryAfterSec / 60)),
        {
          retryAfterSec: outcome.retryAfterSec,
          fields: { code: errors.otpLocked(OTP_LOCK_MIN) },
        },
      );
    }
    case "OK":
      break;
  }

  // Consume atomically so two requests with the same code cannot both succeed.
  const consumed = await db.otpChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) throw fail(errors.otpUsed);
}

export interface FoundUser {
  user: User;
  isNew: boolean;
}

/** An existing person by email, or a new unfinished account (no name yet, no password, not onboarded). */
export async function findOrCreateUser(email: string, now: Date): Promise<FoundUser> {
  const db = getDb();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.status === "SUSPENDED")
      throw new AppError(403, "FORBIDDEN", errors.accountSuspended);
    if (existing.status === "DELETED") throw new AppError(403, "FORBIDDEN", errors.accountDeleted);
    const user = existing.emailVerifiedAt
      ? existing
      : await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: now } });
    return { user, isNew: false };
  }
  const user = await db.user.create({
    data: {
      email,
      emailVerifiedAt: now,
      name: "",
      username: `u_${randomBytes(6).toString("hex")}`,
    },
  });
  return { user, isNew: true };
}
