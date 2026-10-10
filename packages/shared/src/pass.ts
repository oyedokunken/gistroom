// Server only. Imported as "@gistroom/shared/pass" by web and realtime, never by client code.
import { createHmac, timingSafeEqual } from "node:crypto";
import { LIMITS } from "./limits";

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
    if (body.aud !== "gistroom-realtime" || typeof body.exp !== "number") {
      return { ok: false, reason: "MALFORMED" };
    }
    if (body.exp * 1000 <= now.getTime()) return { ok: false, reason: "EXPIRED" };
    return { ok: true, pass: { userId: body.userId, sessionId: body.sessionId } };
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
}
