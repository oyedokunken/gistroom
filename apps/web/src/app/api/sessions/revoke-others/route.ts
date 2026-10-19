import { api, json } from "@/server/http";
import { requireUser, revokeOtherSessions } from "@/server/auth/session";

export const POST = api(async () => {
  const { user, session } = await requireUser();
  const count = await revokeOtherSessions(user.id, session.id);
  return json({ ok: true, revoked: count });
});
