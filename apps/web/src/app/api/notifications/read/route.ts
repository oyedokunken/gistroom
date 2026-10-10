import { z } from "zod";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { markRead } from "@/server/notifications/service";

const schema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(100) }),
]);

export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const body = await parseJson(request, schema);
  const count = await markRead(user.id, "all" in body ? "all" : body.ids);
  return json({ ok: true, count });
});
