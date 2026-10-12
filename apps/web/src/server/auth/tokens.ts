import { createHash, randomBytes } from "node:crypto";
import { LIMITS } from "@gistroom/shared";

export const SESSION_COOKIE = "gr_session";

/** Opaque random session token. Only its hash is stored (Section 6.2). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + LIMITS.SESSION_DAYS * 86_400_000);
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
