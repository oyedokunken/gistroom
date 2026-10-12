import { timingSafeEqual } from "node:crypto";
import { api, json } from "@/server/http";
import { getEnv } from "@/server/env";
import { expireDueCalls } from "@/server/calls/service";
import { sendFriendDigests, sendRoomReminders } from "@/server/mail/notify-email";
import { purgeExpiredActivity } from "@/server/notifications/activity";
import { endEmptyRooms, purgeEndedRoomChat } from "@/server/rooms/service";

export const dynamic = "force-dynamic";

function allowed(request: Request): boolean {
  const env = getEnv();
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  return [env.INTERNAL_SERVICE_TOKEN, env.CRON_SECRET].some((secret) => {
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/**
 * Safety net for work that is due: finishes calls that rang out. The realtime scheduler calls it, and the
 * daily Vercel cron calls it too, so nothing is lost if the realtime service was asleep (Section 10.5).
 */
async function run(request: Request): Promise<Response> {
  if (!allowed(request)) return json({ error: "unauthorized" }, { status: 401 });
  return json({
    expiredCalls: await expireDueCalls(),
    endedRooms: await endEmptyRooms(),
    purgedRoomChat: await purgeEndedRoomChat(),
    purgedActivity: await purgeExpiredActivity(),
    roomReminders: await sendRoomReminders(),
    friendDigests: new Date().getUTCHours() === 7 ? await sendFriendDigests() : 0,
  });
}

export const POST = api(run);
export const GET = api(run);
