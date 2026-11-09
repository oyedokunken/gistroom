import { api, clientIp, json } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { startEmailVerification } from "@/server/account/verify-email";

/** Sends the code that confirms the account's own email address. */
export const POST = api(async () => {
  const { user } = await requireUser();
  const result = await startEmailVerification(user, await clientIp());
  return json({ ok: true, resendAfterSec: result.resendAfterSec });
});
