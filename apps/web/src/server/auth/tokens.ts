import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

const b64 = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export interface RealtimePass {
  userId: string;
  sessionId: string;
}

/** HS256 JWT for the realtime connection. Fifteen minute life (Section 6.3). */
export function signRealtimePass(
  pass: RealtimePass,
  secret: string,
  now: Date = new Date(),
): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64(
    JSON.stringify({
      ...pass,
      iat,
      exp: iat + LIMITS.REALTIME_PASS_MIN * 60,
      aud: "gistroom-realtime",
    }),
  );
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export type PassResult =
  | { ok: true; pass: RealtimePass }
  | { ok: false; reason: "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" };

export function verifyRealtimePass(
  token: string,
  secret: string,
  now: Date = new Date(),
): PassResult {
  const parts = token.split(".");
  const [header, payload, sig] = parts;
  if (parts.length !== 3 || !header || !payload || !sig) return { ok: false, reason: "MALFORMED" };
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }
  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: string };
    if (head.alg !== "HS256") return { ok: false, reason: "BAD_SIGNATURE" };
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      sessionId?: unknown;
      exp?: unknown;
      aud?: unknown;
    };
    if (typeof body.userId !== "string" || typeof body.sessionId !== "string") {
      return { ok: false, reason: "MALFORMED" };
    }
    if (body.aud !== "gistroom-realtime" || typeof body.exp !== "number")
      return { ok: false, reason: "MALFORMED" };
    if (body.exp * 1000 <= now.getTime()) return { ok: false, reason: "EXPIRED" };
    return { ok: true, pass: { userId: body.userId, sessionId: body.sessionId } };
  } catch {
    return { ok: false, reason: "MALFORMED" };
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
