import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDb } from "@gistroom/db";
import { AppError, api, json, parseJson } from "@/server/http";
import { getEnv } from "@/server/env";
import { sendMessage } from "@/server/chat/service";
import { ensureConversation, sendRequest } from "@/server/friends/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** The seeded person who acts, by username. */
  as: z.string().min(1).max(40),
  /** The real person it happens to, by email. */
  to: z.string().email(),
  action: z.enum(["message", "request"]),
  text: z.string().max(500).optional(),
});

function allowed(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const secret = getEnv().INTERNAL_SERVICE_TOKEN;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lets a seeded test person do something to a real account, through the real services, so realtime, push and
 * notifications all fire. Only seeded people can act, and only the service token opens it. Used by `npm run seed:act`.
 */
export const POST = api(async (request) => {
  if (!allowed(request)) return json({ error: "unauthorized" }, { status: 401 });
  const input = await parseJson(request, schema);
  const db = getDb();
  const actor = await db.user.findFirst({ where: { username: input.as, isSeed: true } });
  const target = await db.user.findUnique({ where: { email: input.to } });
  if (!actor || !target || target.isSeed) {
    throw new AppError(404, "NOT_FOUND", "Pick a seeded person and a real account.");
  }
  if (input.action === "request") {
    return json({ outcome: await sendRequest(actor, target.id) });
  }
  const conversationId = await ensureConversation(actor.id, target.id);
  const sent = await sendMessage(actor, conversationId, {
    clientId: `act-${crypto.randomUUID()}`,
    type: "TEXT",
    body: input.text?.trim() || "How far? Just checking in.",
  } as Parameters<typeof sendMessage>[2]);
  return json({ messageId: sent.message.id });
});
