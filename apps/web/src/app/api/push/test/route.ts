import { cookies } from "next/headers";
import { getDb } from "@gistroom/db";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { DEVICE_COOKIE } from "@/server/auth/tokens";
import { getEnv } from "@/server/env";
import { enforce, policies } from "@/server/rate-limit";

/**
 * Sends one real push to this device and says plainly what happened. Unlike the old test button it does not go
 * to every device, and it does not pretend: if the push service refuses, the answer says so.
 */
export const POST = api(async () => {
  const { user } = await requireOnboarded();
  await enforce(policies.pushTest, user.id);
  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
  const sub = await getDb().pushSubscription.findFirst({
    where: { userId: user.id, revokedAt: null, ...(deviceId ? { deviceId } : {}) },
    orderBy: { updatedAt: "desc" },
  });
  if (!sub) return json({ result: "NO_SUBSCRIPTION" });
  const env = getEnv();
  try {
    const res = await fetch(`${env.REALTIME_URL}/internal/push-test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ subscriptionId: sub.id }),
      // A sleeping Render instance can take a while to wake, so this waits longer than most calls.
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return json({ result: "SERVICE_DOWN" });
    const out = (await res.json()) as { ok: boolean; gone: boolean; statusCode: number | null };
    if (out.ok) return json({ result: "SENT" });
    return json({ result: out.gone ? "GONE" : "REFUSED", statusCode: out.statusCode });
  } catch {
    return json({ result: "SERVICE_DOWN" });
  }
});
