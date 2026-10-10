import { verifyOtpSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson, userAgent } from "@/server/http";
import { verifyOtp } from "@/server/auth/otp-service";
import { createSession, setSessionCookie } from "@/server/auth/session";

export const POST = api(async (request) => {
  const { email, code } = await parseJson(request, verifyOtpSchema);
  const { user, isNew } = await verifyOtp(email, code, await clientIp());
  const token = await createSession(user.id, await userAgent());
  await setSessionCookie(token);
  return json({ ok: true, isNew, needsOnboarding: user.onboardedAt === null });
});
