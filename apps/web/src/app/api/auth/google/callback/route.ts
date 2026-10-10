import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { googleOffResponse, isGoogleEnabled } from "@/server/auth/google-flag";
import { AppError, userAgent } from "@/server/http";
import { announceNewDevice } from "@/server/auth/auth-service";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { signInWithGoogle } from "@/server/auth/google-service";
import { OAUTH_COOKIE, exchangeCode, mockIdentity, openState } from "@/server/auth/google";

export const dynamic = "force-dynamic";

function fail(reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, getEnv().APP_URL));
}

export async function GET(request: Request) {
  if (!isGoogleEnabled()) return googleOffResponse();
  const env = getEnv();
  const url = new URL(request.url);
  const jar = await cookies();
  const sealed = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });

  const state = sealed ? openState(sealed, env.SESSION_SECRET) : null;
  const code = url.searchParams.get("code");
  if (!state || !code || url.searchParams.get("state") !== state.state)
    return fail("google_failed");

  try {
    let identity;
    if (env.GOOGLE_MODE === "mock") {
      identity = mockIdentity(code);
      if (!identity) return fail("google_failed");
    } else {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail("google_unavailable");
      identity = await exchangeCode({
        code,
        verifier: state.verifier,
        nonce: state.nonce,
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI ?? `${env.APP_URL}/api/auth/google/callback`,
      });
    }
    const { user } = await signInWithGoogle(identity);
    const created = await createSession(user.id, await userAgent());
    await setSessionCookie(created.token);
    if (created.isNewDevice) void announceNewDevice(user, created.sessionId, created.device);
    const target = user.onboardedAt
      ? state.next
      : `/onboarding?next=${encodeURIComponent(state.next)}`;
    return NextResponse.redirect(new URL(target, env.APP_URL));
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") return fail("account_blocked");
    if (error instanceof AppError) return fail("google_unverified");
    return fail("google_failed");
  }
}
