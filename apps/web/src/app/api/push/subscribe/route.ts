import { z } from "zod";
import { cookies } from "next/headers";
import { getDb } from "@gistroom/db";
import { api, json, parseJson, userAgent } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { DEVICE_COOKIE, isDeviceId } from "@/server/auth/tokens";
import { saveSubscription } from "@/server/push/subscriptions";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});
const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1024) });

/**
 * One row per endpoint. A subscription belongs to a person and a device, never to a session, so a session ending
 * does not touch it. If another person signs in on a browser that already has one, the row moves to them, so alerts
 * never go to the person before (Section 10.4).
 */
export const POST = api(async (request) => {
  const { user, session } = await requireOnboarded();
  const input = await parseJson(request, subscribeSchema);
  const jar = await cookies();
  const cookieId = jar.get(DEVICE_COOKIE)?.value;
  const deviceId = session.deviceId ?? (cookieId && isDeviceId(cookieId) ? cookieId : null);
  await saveSubscription(
    user,
    { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth },
    { deviceId, userAgent: await userAgent() },
  );
  return json({ ok: true });
});

/** Turning alerts off removes the subscription for good. */
export const DELETE = api(async (request) => {
  const { user } = await requireOnboarded();
  const { endpoint } = await parseJson(request, unsubscribeSchema);
  await getDb().pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return json({ ok: true });
});
