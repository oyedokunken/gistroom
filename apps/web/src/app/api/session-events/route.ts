import { z } from "zod";
import { api, assertSameOrigin, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { enforce, policies } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** The reason code of a connection or device dialog, such as net-offline or mic-blocked. */
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9:-]{2,48}$/),
  kind: z.enum(["call", "room"]).optional(),
});

/** Logs that a person saw a call or room dialog, with its reason code. It helps find what goes wrong on real networks. */
export const POST = api(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  await enforce(policies.sessionEvent, user.id);
  const { code, kind } = await parseJson(request, schema);
  logger.info({ userId: user.id, code, kind }, "session modal shown");
  return json({ ok: true });
});
