import { api, json } from "@/server/http";
import { getEnv } from "@/server/env";
import { requireOnboarded } from "@/server/auth/session";
import { signRealtimePass } from "@/server/auth/tokens";

export const dynamic = "force-dynamic";

/** A 15 minute pass for the socket connection. Cookies are never used across the two domains (Section 6.3). */
export const GET = api(async () => {
  const { user, session } = await requireOnboarded();
  const token = signRealtimePass(
    { userId: user.id, sessionId: session.id },
    getEnv().REALTIME_PASS_SECRET,
  );
  return json({ token, expiresInSec: 15 * 60 }, { headers: { "Cache-Control": "no-store" } });
});
