import { verifyOtpSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson, userAgent } from "@/server/http";
import { completeSignup } from "@/server/auth/auth-service";
import { createSession, setSessionCookie } from "@/server/auth/session";

/** The code confirms the email once. The session that follows lets the person finish their profile and set a password. */
export const POST = api(async (request) => {
  const { email, code } = await parseJson(request, verifyOtpSchema);
  const { user } = await completeSignup(email, code, await clientIp());
  const created = await createSession(user.id, await userAgent());
  await setSessionCookie(created.token);
  return json({ ok: true, needsOnboarding: user.onboardedAt === null });
});
