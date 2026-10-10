import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getEnv } from "@/server/env";
import { googleOffResponse, isGoogleEnabled } from "@/server/auth/google-flag";
import { clientIp } from "@/server/http";
import { enforce, policies } from "@/server/rate-limit";
import {
  OAUTH_COOKIE,
  buildAuthUrl,
  mockCode,
  newOAuthState,
  safeNext,
  sealState,
} from "@/server/auth/google";

export const dynamic = "force-dynamic";

/** Start of the Google flow: authorization code with PKCE, state and nonce (Section 6.5). */
export async function GET(request: Request) {
  if (!isGoogleEnabled()) return googleOffResponse();
  const env = getEnv();
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  try {
    await enforce(policies.otpSendIp, `google:${await clientIp()}`);
  } catch {
    return NextResponse.redirect(new URL("/login?error=rate_limited", env.APP_URL));
  }

  const { state, challenge } = newOAuthState(next);
  (await cookies()).set(OAUTH_COOKIE, sealState(state, env.SESSION_SECRET), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600,
  });

  const redirectUri = env.GOOGLE_REDIRECT_URI ?? `${env.APP_URL}/api/auth/google/callback`;

  if (env.GOOGLE_MODE === "mock") {
    const email = url.searchParams.get("mock_email") ?? "google.mock@example.com";
    const callback = new URL(redirectUri);
    callback.searchParams.set("code", mockCode(email));
    callback.searchParams.set("state", state.state);
    return NextResponse.redirect(callback);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", env.APP_URL));
  }
  return NextResponse.redirect(
    buildAuthUrl({
      clientId: env.GOOGLE_CLIENT_ID,
      redirectUri,
      state: state.state,
      nonce: state.nonce,
      challenge,
    }),
  );
}
