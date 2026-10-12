import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getDb, type Session, type User } from "@gistroom/db";
import { LIMITS, errors } from "@gistroom/shared";
import { AUTHED_HINT_COOKIE } from "@/lib/authed-hint";
import { deviceLabel } from "@/lib/device-label";
import { getEnv } from "../env";
import { logger } from "../logger";
import { isNewDevice } from "./rules";
import { AppError, forbidden, unauthorized } from "../http";
import {
  DEVICE_COOKIE,
  SESSION_COOKIE,
  hashToken,
  isDeviceId,
  newSessionToken,
  sessionExpiry,
  shouldSlide,
  type SessionEndReason,
} from "./tokens";

export interface SessionContext {
  session: Session;
  user: User;
}

export interface CreatedSession {
  token: string;
  sessionId: string;
  deviceId: string;
  device: string;
  /** True when the person has signed in before, but never from a device like this one. */
  isNewDevice: boolean;
}

/** Every session end is written down with its reason and logged, so a logout is never a mystery (Section 6.2). */
export async function recordSessionEnd(
  where: { id?: string; userId?: string; excludeId?: string; deviceIds?: string[] },
  reason: SessionEndReason,
  now = new Date(),
): Promise<number> {
  const r = await getDb().session.updateMany({
    where: {
      endedAt: null,
      ...(where.id ? { id: where.id } : {}),
      ...(where.userId ? { userId: where.userId } : {}),
      ...(where.excludeId ? { id: { not: where.excludeId } } : {}),
    },
    data: { endedAt: now, endReason: reason, revokedAt: now },
  });
  if (r.count > 0) logger.info({ reason, count: r.count, sessionId: where.id }, "session ended");
  return r.count;
}

export async function createSession(userId: string, userAgent: string): Promise<CreatedSession> {
  const token = newSessionToken();
  const now = new Date();
  const device = deviceLabel(userAgent);
  const existing = (await cookies()).get(DEVICE_COOKIE)?.value;
  const deviceId =
    existing && isDeviceId(existing) ? existing : randomBytes(24).toString("base64url");
  const earlier = await getDb().session.findMany({
    where: { userId },
    select: { deviceLabel: true },
    take: 50,
    orderBy: { createdAt: "desc" },
  });
  const row = await getDb().session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      deviceId,
      userAgent: userAgent.slice(0, 400),
      deviceLabel: device,
      lastSeenAt: now,
      authenticatedAt: now,
      expiresAt: sessionExpiry(now, now),
    },
    select: { id: true },
  });
  return {
    token,
    sessionId: row.id,
    deviceId,
    device,
    isNewDevice: isNewDevice(
      earlier.map((e) => e.deviceLabel),
      device,
    ),
  };
}

async function cookieIsSecure(): Promise<boolean> {
  // Secure on https, which is every real visit. A plain http address such as localhost cannot keep a Secure cookie.
  const proto = (await headers()).get("x-forwarded-proto");
  return proto
    ? proto === "https"
    : getEnv().NODE_ENV === "production" && getEnv().APP_URL.startsWith("https:");
}

/**
 * Every cookie here is a server Set-Cookie, never written from JavaScript: Safari caps script cookies at 7 days.
 * The session cookie lasts 30 days. The proxy re-issues it on page loads so it slides with the database expiry.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const secure = await cookieIsSecure();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: LIMITS.SESSION_DAYS * 86_400,
    expires: new Date(Date.now() + LIMITS.SESSION_DAYS * 86_400_000),
  });
  // The device cookie outlives any session. It only says which browser this is, so alerts can stay tied to it.
  const row = await getDb().session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { deviceId: true },
  });
  if (row?.deviceId) {
    jar.set(DEVICE_COOKIE, row.deviceId, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: LIMITS.DEVICE_COOKIE_DAYS * 86_400,
      expires: new Date(Date.now() + LIMITS.DEVICE_COOKIE_DAYS * 86_400_000),
    });
  }
  // A hint for the public pages, which are static. No token and no name, only "1". Never trusted for anything.
  jar.set(AUTHED_HINT_COOKIE, "1", {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: LIMITS.SESSION_DAYS * 86_400,
    expires: new Date(Date.now() + LIMITS.SESSION_DAYS * 86_400_000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  (await cookies()).delete(AUTHED_HINT_COOKIE);
}

/** Looks up the current session. Memoised per request. Returns null for any invalid state. */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = new Date();
  const session = await getDb().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) {
    logger.info({ reason: "INVALID_COOKIE" }, "session cookie did not match a session");
    return null;
  }
  if (session.revokedAt) return null;
  const lastDay = new Date(session.createdAt.getTime() + LIMITS.SESSION_MAX_DAYS * 86_400_000);
  if (session.expiresAt <= now || lastDay <= now) {
    await recordSessionEnd({ id: session.id }, "EXPIRED", now).catch(() => undefined);
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;
  if (shouldSlide(session.lastSeenAt, now)) {
    // At most one write a day. Parallel requests may both write, which is harmless: the token never changes.
    await getDb()
      .session.update({
        where: { id: session.id },
        data: { lastSeenAt: now, expiresAt: sessionExpiry(now, session.createdAt) },
      })
      .catch(() => undefined);
  }
  const { user, ...rest } = session;
  return { session: rest, user };
});

/** For API routes: a signed in, ACTIVE person or a 401. */
export async function requireUser(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw unauthorized();
  return ctx;
}

/** For app features that need a finished profile. */
export async function requireOnboarded(): Promise<SessionContext> {
  const ctx = await requireUser();
  if (!ctx.user.onboardedAt) throw forbidden(errors.notOnboarded);
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireOnboarded();
  if (ctx.user.role !== "ADMIN") throw new AppError(404, "NOT_FOUND", errors.notFound);
  return ctx;
}

/** True when the person proved who they are recently enough for a sensitive action. */
export function hasRecentAuth(
  session: Pick<Session, "authenticatedAt">,
  now = new Date(),
): boolean {
  return now.getTime() - session.authenticatedAt.getTime() <= LIMITS.RECENT_AUTH_MIN * 60_000;
}

/** Sensitive actions ask for the password again when the last sign in was more than 15 minutes ago. */
export function requireRecentAuth(ctx: SessionContext): void {
  if (!hasRecentAuth(ctx.session)) {
    throw new AppError(403, "REAUTH", errors.reauthNeeded);
  }
}

export async function markAuthenticated(sessionId: string): Promise<void> {
  await getDb().session.update({ where: { id: sessionId }, data: { authenticatedAt: new Date() } });
}

/** Deletes the push subscriptions of devices that were signed out on purpose. The current device is never in the list. */
async function dropSubscriptionsOfDevices(userId: string, deviceIds: string[]): Promise<void> {
  const ids = deviceIds.filter(Boolean);
  if (ids.length === 0) return;
  await getDb().pushSubscription.deleteMany({ where: { userId, deviceId: { in: ids } } });
}

export async function revokeSession(
  sessionId: string,
  userId: string,
  reason: SessionEndReason = "REVOKED_BY_USER",
): Promise<boolean> {
  const row = await getDb().session.findFirst({
    where: { id: sessionId, userId },
    select: { deviceId: true },
  });
  const count = await recordSessionEnd({ id: sessionId, userId }, reason);
  if (count > 0 && row?.deviceId) {
    // Only when no other live session still uses this device, so a second tab does not lose its alerts.
    const alive = await getDb().session.count({
      where: { userId, deviceId: row.deviceId, endedAt: null, id: { not: sessionId } },
    });
    if (alive === 0) await dropSubscriptionsOfDevices(userId, [row.deviceId]);
  }
  return count > 0;
}

/** Ends every session, for example after a password reset. Alerts stay only on `keepDeviceId`. */
export async function revokeAllSessions(
  userId: string,
  keepDeviceId: string | null,
): Promise<number> {
  const all = await getDb().session.findMany({
    where: { userId, endedAt: null },
    select: { deviceId: true },
  });
  const count = await recordSessionEnd({ userId }, "REVOKED_ALL");
  await dropSubscriptionsOfDevices(
    userId,
    [...new Set(all.map((a) => a.deviceId ?? ""))].filter((d) => d !== (keepDeviceId ?? "-")),
  );
  return count;
}

/** Explicit sign out: this session ends and this browser stops getting alerts for the account. */
export async function signOutThisDevice(
  sessionId: string,
  userId: string,
  deviceId: string | null,
): Promise<void> {
  await recordSessionEnd({ id: sessionId, userId }, "REVOKED_BY_USER");
  if (deviceId) await dropSubscriptionsOfDevices(userId, [deviceId]);
}

/** Signs out every other device. The device of `keepSessionId` keeps its session and its alerts. */
export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const keep = await getDb().session.findUnique({
    where: { id: keepSessionId },
    select: { deviceId: true },
  });
  const others = await getDb().session.findMany({
    where: { userId, endedAt: null, id: { not: keepSessionId } },
    select: { deviceId: true },
  });
  const count = await recordSessionEnd({ userId, excludeId: keepSessionId }, "REVOKED_ALL");
  await dropSubscriptionsOfDevices(
    userId,
    [...new Set(others.map((o) => o.deviceId ?? ""))].filter((d) => d !== (keep?.deviceId ?? "-")),
  );
  return count;
}
