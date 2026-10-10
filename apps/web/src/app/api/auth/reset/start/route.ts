import { resetStartSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { startReset } from "@/server/auth/auth-service";

export const POST = api(async (request) => {
  const { email } = await parseJson(request, resetStartSchema);
  const result = await startReset(email, await clientIp());
  return json({ ok: true, resendAfterSec: result.resendAfterSec });
});
