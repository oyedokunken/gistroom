import { resetCompleteSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson, userAgent } from "@/server/http";
import { announceNewDevice, completeReset } from "@/server/auth/auth-service";
import { createSession, setSessionCookie } from "@/server/auth/session";

/** The code proves the email, the new password replaces the old one, and every other device is signed out. */
export const POST = api(async (request) => {
  const { email, code, password } = await parseJson(request, resetCompleteSchema);
  const user = await completeReset(email, code, password, await clientIp());
  const created = await createSession(user.id, await userAgent());
  await setSessionCookie(created.token);
  if (created.isNewDevice) void announceNewDevice(user, created.sessionId, created.device);
  return json({ ok: true, needsOnboarding: user.onboardedAt === null });
});
