import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { activeRings } from "@/server/rings/service";

export const dynamic = "force-dynamic";

/** What is ringing for me right now, with the time left on the server's clock. Read on load, focus and reconnect. */
export const GET = api(async () => {
  const { user } = await requireOnboarded();
  return json(await activeRings(user), { headers: { "Cache-Control": "no-store" } });
});
