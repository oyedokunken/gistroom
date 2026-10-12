import { changeEmailStartSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { startEmailChange } from "@/server/account/service";
import { requireUser } from "@/server/auth/session";

export const POST = api(async (request) => {
  const { user } = await requireUser();
  const input = await parseJson(request, changeEmailStartSchema);
  const result = await startEmailChange(user, input, await clientIp());
  return json({ ok: true, resendAfterSec: result.resendAfterSec });
});
