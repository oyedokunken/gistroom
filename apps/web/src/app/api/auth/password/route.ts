import { getDb } from "@gistroom/db";
import { errors, setPasswordSchema } from "@gistroom/shared";
import { api, conflict, json, parseJson } from "@/server/http";
import { setInitialPassword } from "@/server/auth/auth-service";
import { nextAuthStep } from "@/server/auth/rules";
import { requireUser } from "@/server/auth/session";

/** Sets the first password right after the email is confirmed. Changing one later goes through Settings. */
export const POST = api(async (request) => {
  const { user } = await requireUser();
  if (user.passwordHash) throw conflict(errors.passwordAlreadySet);
  const { password } = await parseJson(request, setPasswordSchema);
  await setInitialPassword(user, password);
  const googleLinked = (await getDb().authAccount.count({ where: { userId: user.id } })) > 0;
  const step = nextAuthStep({ passwordHash: "set", onboardedAt: user.onboardedAt, googleLinked });
  return json({ ok: true, step });
});
