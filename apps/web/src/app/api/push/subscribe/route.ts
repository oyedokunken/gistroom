import { z } from "zod";
import { getDb } from "@gistroom/db";
import { api, json, parseJson, userAgent } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});
const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1024) });

/** One row per endpoint. Re-subscribing from the same browser revives a revoked row (Section 10.4). */
export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, subscribeSchema);
  const data = {
    userId: user.id,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    userAgent: (await userAgent()).slice(0, 300),
    revokedAt: null,
    failureCount: 0,
  };
  await getDb().pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
  });
  return json({ ok: true });
});

export const DELETE = api(async (request) => {
  const { user } = await requireOnboarded();
  const { endpoint } = await parseJson(request, unsubscribeSchema);
  await getDb().pushSubscription.updateMany({
    where: { endpoint, userId: user.id },
    data: { revokedAt: new Date() },
  });
  return json({ ok: true });
});
