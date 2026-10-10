import { loginSchema } from "@gistroom/shared";
import { api, clientIp, json, parseJson, userAgent } from "@/server/http";
import { announceNewDevice, login } from "@/server/auth/auth-service";
import { createSession, setSessionCookie } from "@/server/auth/session";

export const POST = api(async (request) => {
  const { email, password } = await parseJson(request, loginSchema);
  const user = await login(email, password, await clientIp());
  const created = await createSession(user.id, await userAgent());
  await setSessionCookie(created.token);
  if (created.isNewDevice) void announceNewDevice(user, created.sessionId, created.device);
  return json({ ok: true, needsOnboarding: user.onboardedAt === null });
});
