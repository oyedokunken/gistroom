import { changePasswordSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { changePassword } from "@/server/auth/auth-service";
import { requireUser } from "@/server/auth/session";

export const POST = api(async (request) => {
  const { user, session } = await requireUser();
  const input = await parseJson(request, changePasswordSchema);
  await changePassword(user, session.id, input);
  return json({ ok: true, hadPassword: user.passwordHash !== null });
});
