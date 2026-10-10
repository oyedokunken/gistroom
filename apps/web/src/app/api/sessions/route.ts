import { getDb } from "@gistroom/db";
import type { SessionInfo } from "@gistroom/shared";
import { api, json } from "@/server/http";
import { requireUser } from "@/server/auth/session";

export const GET = api(async () => {
  const { user, session } = await requireUser();
  const rows = await getDb().session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
  });
  const sessions: SessionInfo[] = rows.map((s) => ({
    id: s.id,
    deviceLabel: s.deviceLabel ?? "Unknown device",
    lastSeenAt: s.lastSeenAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    current: s.id === session.id,
  }));
  return json({ sessions });
});
