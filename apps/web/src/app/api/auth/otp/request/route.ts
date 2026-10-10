import { requestOtpSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { requestOtp } from "@/server/auth/otp-service";

export const POST = api(async (request) => {
  const { email } = await parseJson(request, requestOtpSchema);
  const result = await requestOtp(email, await clientIp());
  return json({ ok: true, resendAfterSec: result.resendAfterSec });
});
