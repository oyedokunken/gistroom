import { requestOtpSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { startSignup } from "@/server/auth/auth-service";

export const POST = api(async (request) => {
  const { email } = await parseJson(request, requestOtpSchema);
  const result = await startSignup(email, await clientIp());
  return json({ ok: true, resendAfterSec: result.resendAfterSec });
});
