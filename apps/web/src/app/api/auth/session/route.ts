import { cookies } from "next/headers";
import { AUTHED_HINT_COOKIE } from "@/lib/authed-hint";
import { getSessionContext } from "@/server/auth/session";
import { api, json } from "@/server/http";
import { toMe } from "@/server/users/serialize";

export const dynamic = "force-dynamic";

/**
 * Who is signed in, for the public pages. They are static and cannot know, so they ask here after loading.
 * Nobody is asked to prove anything: no session cookie answers at once without touching the database.
 */
export const GET = api(async () => {
  const headers = { "Cache-Control": "no-store" };
  let ctx: Awaited<ReturnType<typeof getSessionContext>>;
  try {
    ctx = await getSessionContext();
  } catch {
    // The database did not answer. Say so, and leave the hint alone, so nobody is shown the wrong button for good.
    return json({ authed: false, person: null, unknown: true }, { headers });
  }
  if (!ctx || !ctx.user.onboardedAt) {
    // A stale hint is cleaned up, so the next page does not flash the wrong button.
    (await cookies()).delete(AUTHED_HINT_COOKIE);
    return json({ authed: false, person: null }, { headers });
  }
  const me = toMe(ctx.user);
  return json(
    { authed: true, person: { name: me.name, username: me.username, avatarUrl: me.avatarUrl } },
    { headers },
  );
});
