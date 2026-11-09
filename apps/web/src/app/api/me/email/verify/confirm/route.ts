import { z } from "zod";
import { otpCodeSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { confirmEmailVerification } from "@/server/account/verify-email";

const schema = z.object({ code: otpCodeSchema });

export const POST = api(async (request) => {
  const { user } = await requireUser();
  const { code } = await parseJson(request, schema);
  const result = await confirmEmailVerification(user, { code }, await clientIp());
  return json({ ok: true, verifiedAt: result.verifiedAt.toISOString() });
});
