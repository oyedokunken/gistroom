import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, staticSecurityHeaders } from "@/lib/security-headers";

const DAY_SEC = 86_400;

/**
 * Re-issues the session, device and hint cookies with a fresh lifetime on page loads, so the cookie slides with the
 * database expiry instead of ending 30 days after sign in. The value never changes, so parallel requests cannot clash.
 * Whether the session is still good is decided by the database, never by this cookie.
 */
function renewCookies(request: NextRequest, response: NextResponse) {
  const accept = request.headers.get("accept") ?? "";
  if (request.method !== "GET" || !accept.includes("text/html")) return;
  const session = request.cookies.get("gr_session")?.value;
  if (!session) return;
  const secure =
    (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) ===
    "https";
  const base = { path: "/", sameSite: "lax" as const, secure };
  response.cookies.set("gr_session", session, {
    ...base,
    httpOnly: true,
    maxAge: 30 * DAY_SEC,
    expires: new Date(Date.now() + 30 * DAY_SEC * 1000),
  });
  const device = request.cookies.get("gr_device")?.value;
  if (device) {
    response.cookies.set("gr_device", device, {
      ...base,
      httpOnly: true,
      maxAge: 365 * DAY_SEC,
      expires: new Date(Date.now() + 365 * DAY_SEC * 1000),
    });
  }
  if (request.cookies.get("gr_authed")?.value === "1") {
    response.cookies.set("gr_authed", "1", {
      ...base,
      httpOnly: false,
      maxAge: 30 * DAY_SEC,
      expires: new Date(Date.now() + 30 * DAY_SEC * 1000),
    });
  }
}

/** Next 16 name for middleware. Sets the nonce based CSP and the static security headers. */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== "production",
    realtimeUrl: process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000",
    livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [key, value] of Object.entries(staticSecurityHeaders))
    response.headers.set(key, value);
  renewCookies(request, response);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|fonts/|images/|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
