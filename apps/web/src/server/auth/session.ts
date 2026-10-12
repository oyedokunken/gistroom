import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getDb, type Session, type User } from "@gistroom/db";
import { errors } from "@gistroom/shared";
import { deviceLabel } from "@/lib/device-label";
import { getEnv } from "../env";
import { isNewDevice } from "./rules";
import { AppError, forbidden, unauthorized } from "../http";
import { SESSION_COOKIE, hashToken, newSessionToken, sessionExpiry, shouldSlide } from "./tokens";

export interface SessionContext {
  session: Session;
  user: User;
}

export interface CreatedSession {
  token: string;
  sessionId: string;
  device: string;
  /** True when the person has signed in before, but never from a device like this one. */
  isNewDevice: boolean;
}

export async function createSession(userId: string, userAgent: string): Promise<CreatedSession> {
  const token = newSessionToken();
  const now = new Date();
  const device = deviceLabel(userAgent);
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
      userAgent: userAgent.slice(0, 400),
      deviceLabel: device,
      lastSeenAt: now,
      expiresAt: sessionExpiry(now),
    },
    select: { id: true },
  });
  return {
    token,
    sessionId: row.id,
    device,
    isNewDevice: isNewDevice(
      earlier.map((e) => e.deviceLabel),
      device,
    ),
  };
}

export async function setSessionCookie(token: string): Promise<void> {
  // Secure on https, which is every real visit. A plain http address such as localhost cannot keep a Secure cookie.
  const proto = (await headers()).get("x-forwarded-proto");
  const secure = proto
    ? proto === "https"
    : getEnv().NODE_ENV === "production" && getEnv().APP_URL.startsWith("https:");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
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
  if (!session || session.revokedAt || session.expiresAt <= now) return null;
  if (session.user.status !== "ACTIVE") return null;
  if (shouldSlide(session.lastSeenAt, now)) {
    await getDb().session.update({
      where: { id: session.id },
      data: { lastSeenAt: now, expiresAt: sessionExpiry(now) },
    });
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

export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const r = await getDb().session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count > 0;
}

export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  const r = await getDb().session.updateMany({
    where: { userId, revokedAt: null, id: { not: keepSessionId } },
    data: { revokedAt: new Date() },
  });
  return r.count;
}
