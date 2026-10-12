import { deleteAccountConfirmSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson } from "@/server/http";
import { confirmAccountDeletion } from "@/server/account/service";
import { clearSessionCookie, requireUser } from "@/server/auth/session";

export const POST = api(async (request) => {
  const { user } = await requireUser();
  const input = await parseJson(request, deleteAccountConfirmSchema);
  await confirmAccountDeletion(user, input, await clientIp());
  await clearSessionCookie();
  return json({ ok: true });
});
