import { api, json } from "@/server/http";
import { cookies } from "next/headers";
import { clearSessionCookie, getSessionContext, signOutThisDevice } from "@/server/auth/session";
import { DEVICE_COOKIE } from "@/server/auth/tokens";

export const POST = api(async () => {
  const ctx = await getSessionContext();
  // Signing out on purpose also stops alerts on this browser, so a shared computer never shows the next person's gist.
  if (ctx) {
    const device = ctx.session.deviceId ?? (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
    await signOutThisDevice(ctx.session.id, ctx.user.id, device);
  }
  await clearSessionCookie();
  return json({ ok: true });
});
