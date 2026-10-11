import { getDb } from "@gistroom/db";
import { verifyOtpSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson, userAgent } from "@/server/http";
import { completeSignup } from "@/server/auth/auth-service";
import { nextAuthStep } from "@/server/auth/rules";
import { createSession, setSessionCookie } from "@/server/auth/session";

/** The code confirms the email once. The session that follows lets the person set a password, then finish their profile. */
export const POST = api(async (request) => {
  const { email, code } = await parseJson(request, verifyOtpSchema);
  const { user } = await completeSignup(email, code, await clientIp());
  const created = await createSession(user.id, await userAgent());
  await setSessionCookie(created.token);
  const googleLinked = (await getDb().authAccount.count({ where: { userId: user.id } })) > 0;
  return json({ ok: true, step: nextAuthStep({ ...user, googleLinked }) });
});
