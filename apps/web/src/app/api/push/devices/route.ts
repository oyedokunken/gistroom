import { cookies } from "next/headers";
import { getDb } from "@gistroom/db";
import { api, assertSameOrigin, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { DEVICE_COOKIE } from "@/server/auth/tokens";

export const dynamic = "force-dynamic";

export interface PushDeviceDto {
  id: string;
  label: string;
  current: boolean;
  lastSuccessAt: string | null;
  createdAt: string;
  failureCount: number;
  unhealthy: boolean;
  needsReauth: boolean;
  /** The session on this device ended, so alerts are plain until the person signs in again. */
  signedOut: boolean;
  /** Unhealthy and the person has not been told yet. */
  notice: boolean;
}

/** Every device that gets alerts for this person, with its health, in plain fields. */
export const GET = api(async () => {
  const { user } = await requireOnboarded();
  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
  const rows = await getDb().pushSubscription.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const devices: PushDeviceDto[] = rows.map((r) => ({
    id: r.id,
    label: r.deviceLabel ?? "A browser",
    current: deviceId !== null && r.deviceId === deviceId,
    lastSuccessAt: r.lastSuccessAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    failureCount: r.failureCount,
    unhealthy: r.unhealthyAt !== null,
    needsReauth: r.needsReauth,
    signedOut: r.sessionEndedAt !== null,
    notice: r.unhealthyAt !== null && r.unhealthySeenAt === null,
  }));
  return json({ devices });
});

/** Remove one device. Alerts stop there, its sessions are not touched. */
export const DELETE = api(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await getDb().pushSubscription.deleteMany({ where: { id, userId: user.id } });
  return json({ ok: true });
});

/** The person has been told a device is unhealthy. */
export const POST = api(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireOnboarded();
  await getDb().pushSubscription.updateMany({
    where: { userId: user.id, unhealthyAt: { not: null }, unhealthySeenAt: null },
    data: { unhealthySeenAt: new Date() },
  });
  return json({ ok: true });
});
