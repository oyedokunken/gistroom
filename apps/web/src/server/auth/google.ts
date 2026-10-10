import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const OAUTH_COOKIE = "gr_oauth";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** PKCE S256 pair (RFC 7636). */
export function pkcePair(): PkcePair {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export interface OAuthState {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  exp: number;
}

export function newOAuthState(
  next: string,
  now: Date = new Date(),
): { state: OAuthState; challenge: string } {
  const { verifier, challenge } = pkcePair();
  return {
    state: {
      state: randomBytes(24).toString("base64url"),
      nonce: randomBytes(24).toString("base64url"),
      verifier,
      next,
      exp: Math.floor(now.getTime() / 1000) + 600,
    },
    challenge,
  };
}

/** Signed cookie value. The cookie holds the PKCE verifier, so it is also httpOnly. */
export function sealState(state: OAuthState, secret: string): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function openState(
  value: string,
  secret: string,
  now: Date = new Date(),
): OAuthState | null {
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<OAuthState>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.next !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp * 1000 <= now.getTime()) return null;
    return parsed as OAuthState;
  } catch {
    return null;
  }
}

/** Only same site paths. Blocks open redirects such as //evil.example and /\evil.example. */
export function safeNext(next: string | null | undefined, fallback = "/app/chats"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\"))
    return fallback;
  if ([...next].some((ch) => ch.charCodeAt(0) < 32)) return fallback;
  return next;
}

export function buildAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
}): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export const MOCK_PREFIX = "mock:";

/** Mock identities exist for dev and tests only. The env schema refuses mock mode in production. */
export function mockCode(email: string): string {
  return `${MOCK_PREFIX}${Buffer.from(email.toLowerCase()).toString("base64url")}`;
}

export function mockIdentity(code: string): GoogleIdentity | null {
  if (!code.startsWith(MOCK_PREFIX)) return null;
  const email = Buffer.from(code.slice(MOCK_PREFIX.length), "base64url").toString("utf8");
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) return null;
  const sub = `mock-${createHash("sha256").update(email).digest("hex").slice(0, 20)}`;
  return { sub, email, emailVerified: true, name: email.split("@")[0] ?? "Mock user" };
}

/** Exchange the code, then verify the ID token on the server (signature, issuer, audience, nonce). */
export async function exchangeCode(input: {
  code: string;
  verifier: string;
  nonce: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.verifier,
    }),
  });
  if (!res.ok) throw new Error("token exchange failed");
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("no id token");
  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(JWKS_URL)), {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: input.clientId,
  });
  if (payload.nonce !== input.nonce) throw new Error("nonce mismatch");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string")
    throw new Error("bad claims");
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : (payload.email.split("@")[0] ?? ""),
  };
}

export type GoogleAction = "SIGN_IN" | "LINK" | "CREATE" | "REFUSE_UNVERIFIED";

/**
 * Decide what a verified Google identity does. An unverified email is never trusted.
 * If the verified email matches an OTP account, link them: both emails are verified (Section 6.5).
 */
export function resolveGoogleAction(input: {
  emailVerified: boolean;
  accountExists: boolean;
  emailUserExists: boolean;
}): GoogleAction {
  if (!input.emailVerified) return "REFUSE_UNVERIFIED";
  if (input.accountExists) return "SIGN_IN";
  if (input.emailUserExists) return "LINK";
  return "CREATE";
}
