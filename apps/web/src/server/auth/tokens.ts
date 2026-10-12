import { createHash, randomBytes } from "node:crypto";
import { LIMITS } from "@gistroom/shared";

export const SESSION_COOKIE = "gr_session";
/** A long lived id for this browser. It says which device alerts belong to, and it is not a secret. */
export const DEVICE_COOKIE = "gr_device";

export type SessionEndReason =
  | "EXPIRED"
  | "REVOKED_BY_USER"
  | "REVOKED_ALL"
  | "ACCOUNT_DELETED"
  | "SWEPT"
  | "INVALID_COOKIE"
  | "ERROR";

export const isDeviceId = (v: string): boolean => /^[A-Za-z0-9_-]{24,64}$/.test(v);

/** Opaque random session token. Only its hash is stored (Section 6.2). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 30 days from now, but never past 90 days after the session began. */
export function sessionExpiry(now: Date, createdAt: Date): Date {
  const idle = now.getTime() + LIMITS.SESSION_DAYS * 86_400_000;
  const cap = createdAt.getTime() + LIMITS.SESSION_MAX_DAYS * 86_400_000;
  return new Date(Math.min(idle, cap));
}

/** Sliding expiry: only write when more than a day has passed, so reads do not become writes. */
export function shouldSlide(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() > 86_400_000;
}

export interface CookieOptions {
  secure: boolean;
  maxAgeSec?: number;
}

/** Cookie attributes from Section 6.2: httpOnly, Secure, SameSite=Lax. */
export function sessionCookieAttributes({ secure, maxAgeSec }: CookieOptions): string {
  const maxAge = maxAgeSec ?? LIMITS.SESSION_DAYS * 86_400;
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export {
  signRealtimePass,
  verifyRealtimePass,
  type PassResult,
  type RealtimePass,
} from "@gistroom/shared/pass";

/**
 * True when the Origin is this very host. A page loaded from any address that reaches the app (the main domain, an alias,
 * a preview address) may call its own API, while a page on another site never matches.
 */
export function isOriginOnHost(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Origin header check for mutating routes (CSRF, Section 6.2). Missing Origin on a mutation is refused. */
export function isAllowedOrigin(origin: string | null, appUrl: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
