import { getDb } from "@gistroom/db";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/**
 * The last stages of the person's own notifications: created, claimed, sent to a tab, pushed or rejected, retried or
 * dropped. It holds reasons and status codes only, never message text, so it is safe to show in Settings for diagnosis.
 */
export const GET = api(async () => {
  const { user } = await requireOnboarded();
  const rows = await getDb().notificationDelivery.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, notificationId: true, stage: true, detail: true, createdAt: true },
  });
  return json({
    deliveries: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
});
