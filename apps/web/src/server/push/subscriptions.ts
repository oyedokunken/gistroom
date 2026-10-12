import { getDb, type User } from "@gistroom/db";
import { deviceLabel } from "@/lib/device-label";

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Save or move a subscription. One row per endpoint: a browser that another person used before moves to the
 * person signing in now, so alerts never go to the previous person (Section 10.4). Nothing here involves a session.
 */
export async function saveSubscription(
  user: Pick<User, "id">,
  input: SubscriptionInput,
  device: { deviceId: string | null; userAgent: string },
): Promise<void> {
  const ua = device.userAgent.slice(0, 300);
  const data = {
    userId: user.id,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: ua,
    deviceId: device.deviceId,
    deviceLabel: deviceLabel(ua),
    revokedAt: null,
    failureCount: 0,
    needsReauth: false,
    sessionEndedAt: null,
    unhealthyAt: null,
    unhealthySeenAt: null,
  };
  await getDb().pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
  });
}
