import { getDb } from "@gistroom/db";
import { rateLimited } from "./http";

export interface Policy {
  /** Short name used in the key. */
  name: string;
  limit: number;
  windowSec: number;
}

/** Limits from Section 20 and 9. A key is `${policy.name}:${subject}`. */
export const policies = {
  otpSendIp: { name: "otp-ip", limit: 20, windowSec: 3600 },
  otpVerifyIp: { name: "otp-verify-ip", limit: 60, windowSec: 3600 },
  loginIp: { name: "login-ip", limit: 30, windowSec: 900 },
  loginEmail: { name: "login-email", limit: 8, windowSec: 900 },
  accountExists: { name: "account-exists", limit: 3, windowSec: 3600 },
  passwordChange: { name: "password-change", limit: 10, windowSec: 3600 },
  usernameCheck: { name: "username-check", limit: 60, windowSec: 60 },
  peopleSearch: { name: "search", limit: 30, windowSec: 60 },
  friendRequestHour: { name: "fr-hour", limit: 10, windowSec: 3600 },
  friendRequestDay: { name: "fr-day", limit: 30, windowSec: 86_400 },
  messages: { name: "msg", limit: 60, windowSec: 60 },
  mediaSign: { name: "media-sign", limit: 30, windowSec: 60 },
  roomCreate: { name: "room-create", limit: 10, windowSec: 3600 },
  callStart: { name: "call-start", limit: 10, windowSec: 60 },
  reports: { name: "reports", limit: 10, windowSec: 3600 },
  contact: { name: "contact", limit: 5, windowSec: 3600 },
} as const satisfies Record<string, Policy>;

/** Start of the fixed window that contains `now`. */
export function windowStart(now: Date, windowSec: number): Date {
  const ms = windowSec * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

export interface Decision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Pure decision from the count after this hit. */
export function decide(count: number, policy: Policy, now: Date): Decision {
  const start = windowStart(now, policy.windowSec).getTime();
  const resetIn = Math.max(1, Math.ceil((start + policy.windowSec * 1000 - now.getTime()) / 1000));
  return {
    allowed: count <= policy.limit,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSec: count <= policy.limit ? 0 : resetIn,
  };
}

/** Database backed fixed window limiter for the Vercel side. One upsert per hit. */
export async function hit(
  policy: Policy,
  subject: string,
  now: Date = new Date(),
): Promise<Decision> {
  const row = await getDb().rateLimit.upsert({
    where: {
      key_windowStart: {
        key: `${policy.name}:${subject}`,
        windowStart: windowStart(now, policy.windowSec),
      },
    },
    create: {
      key: `${policy.name}:${subject}`,
      windowStart: windowStart(now, policy.windowSec),
      count: 1,
    },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return decide(row.count, policy, now);
}

/** Hit and throw a 429 when over the limit (R17). */
export async function enforce(policy: Policy, subject: string): Promise<void> {
  const decision = await hit(policy, subject);
  if (!decision.allowed) throw rateLimited(decision.retryAfterSec);
}
