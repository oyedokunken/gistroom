import { changeEmailConfirmSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { confirmEmailChange } from "@/server/account/service";
import { requireUser } from "@/server/auth/session";
import { toMe } from "@/server/users/serialize";

export const POST = api(async (request) => {
  const { user, session } = await requireUser();
  const input = await parseJson(request, changeEmailConfirmSchema);
  const updated = await confirmEmailChange(user, session.id, input, await clientIp());
  return json({ ok: true, user: toMe(updated) });
});
