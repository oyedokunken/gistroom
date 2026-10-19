import { getDb } from "@gistroom/db";
import { api, json } from "@/server/http";
import { getEnv } from "@/server/env";
import { isUniqueViolation } from "@/server/db-errors";
import { endCallByLiveKitRoom } from "@/server/calls/service";
import { reconcileLiveRooms } from "@/server/rooms/service";
import { logger } from "@/server/logger";
import { verifyWebhook } from "@/server/livekit-webhook";

export const dynamic = "force-dynamic";

interface WebhookEvent {
  id?: string;
  event?: string;
  createdAt?: number | string;
  room?: { name?: string };
  participant?: { identity?: string };
}

/**
 * LiveKit tells us when someone joins or leaves and when a room closes. These are hints, never the truth: each one
 * only asks for a reconcile of that room, which reads who is really connected. That makes repeated deliveries and
 * out of order events harmless. A delivery we have seen before (same event id) is ignored.
 */
export const POST = api(
  async (request) => {
    const env = getEnv();
    if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return json({ ok: true, ignored: "off" });
    const body = await request.text();
    if (
      !verifyWebhook(
        request.headers.get("authorization"),
        body,
        env.LIVEKIT_API_SECRET,
        env.LIVEKIT_API_KEY,
      )
    ) {
      return json({ error: "unauthorized" }, { status: 401 });
    }
    let event: WebhookEvent;
    try {
      event = JSON.parse(body) as WebhookEvent;
    } catch {
      return json({ error: "bad body" }, { status: 400 });
    }
    if (event.id) {
      try {
        await getDb().liveKitEvent.create({ data: { id: event.id } });
      } catch (e) {
        if (isUniqueViolation(e)) return json({ ok: true, duplicate: true });
        throw e;
      }
    }
    const room = event.room?.name;
    if (!room) return json({ ok: true });
    logger.info({ event: event.event, room }, "livekit webhook");
    if (event.event === "participant_left" || event.event === "room_finished") {
      if (room.startsWith("room_")) await reconcileLiveRooms(new Date(), room);
    }
    if (event.event === "room_finished" && room.startsWith("call_"))
      await endCallByLiveKitRoom(room);
    return json({ ok: true });
  },
  // LiveKit calls this server to server, so there is no Origin to check. The signed Authorization header is verified first.
  { csrf: "none" },
);
