import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, staticSecurityHeaders } from "@/lib/security-headers";

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
