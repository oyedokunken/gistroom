import { api, clientIp, json } from "@/server/http";
import { startAccountDeletion } from "@/server/account/service";
import { requireUser } from "@/server/auth/session";

/** Sends the code that confirms a deletion. Nothing is deleted yet. */
export const POST = api(async () => {
  const { user } = await requireUser();
  const result = await startAccountDeletion(user, await clientIp());
  return json({ ok: true, resendAfterSec: result.resendAfterSec });
});
