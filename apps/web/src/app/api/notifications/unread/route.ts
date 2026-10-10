import { z } from "zod";
import { getDb } from "@gistroom/db";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { publish } from "@/server/realtime";

const schema = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(100) });

/** Mark notifications unread again (Section 9.7). */
export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const { ids } = await parseJson(request, schema);
  const r = await getDb().notification.updateMany({
    where: { userId: user.id, id: { in: ids } },
    data: { readAt: null },
  });
  void publish({ type: "badge", userId: user.id });
  return json({ ok: true, count: r.count });
});
