import { api, assertSameOrigin, json } from "@/server/http";
import { clearSessionCookie, getSessionContext, revokeSession } from "@/server/auth/session";

export const POST = api(async (request) => {
  assertSameOrigin(request);
  const ctx = await getSessionContext();
  if (ctx) await revokeSession(ctx.session.id, ctx.user.id);
  await clearSessionCookie();
  return json({ ok: true });
});
