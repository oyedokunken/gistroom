import { getDb } from "@gistroom/db";
import { LIMITS, liveKitIdentity } from "@gistroom/shared";
import { listIdentities } from "../livekit";
import { notify } from "../notifications/service";
import { publish } from "../realtime";
import { cancelNoShowRooms as cancelNoShowRoomsImpl } from "./registration";
import { handOverHost } from "./membership";
import { finishRoom } from "./lifecycle";

/**
 * Makes the database match what is really happening in every live room, so a crashed tab or a missed webhook can never
 * leave a room stuck. It ends rooms that stayed empty for 5 minutes or ran 8 hours, marks people who stopped sending
 * heartbeats as left, and hands the room on when the host has been gone past the grace period. LiveKit is asked who is
 * connected and is believed over a heartbeat. Safe to run often.
 */
export async function reconcileLiveRooms(
  now = new Date(),
  only?: string,
): Promise<{
  left: number;
  ended: number;
  handedOver: number;
}> {
  const db = getDb();
  const out = { left: 0, ended: 0, handedOver: 0 };
  const rooms = await db.room.findMany({
    where: { status: "LIVE", ...(only ? { livekitRoom: only } : {}) },
    include: { host: true, topic: { select: { slug: true, name: true } }, members: true },
    take: 200,
  });
  for (const room of rooms) {
    const connected = await listIdentities(room.livekitRoom);
    const staleBefore = now.getTime() - LIMITS.HEARTBEAT_GONE_SEC * 1000;
    for (const m of room.members) {
      if (m.state !== "JOINED") continue;
      const lastSign = (m.heartbeatAt ?? m.joinedAt ?? m.updatedAt).getTime();
      const gone =
        connected !== null
          ? // LiveKit answered: not connected there and silent for a while means gone.
            !connected.includes(liveKitIdentity(m.userId)) && lastSign < staleBefore
          : lastSign < staleBefore;
      if (!gone) continue;
      await db.roomMember.update({
        where: { id: m.id },
        data: {
          state: "LEFT",
          leftAt: now,
          graceUntil: new Date(now.getTime() + LIMITS.ROOM_REJOIN_GRACE_SEC * 1000),
        },
      });
      void publish({ type: "room", roomId: room.id, change: "member", userId: m.userId });
      out.left += 1;
    }

    // The host dropped and the grace period is over: the room passes on.
    const host = room.members.find((m) => m.userId === room.hostId);
    if (host && host.state !== "JOINED" && host.graceUntil && host.graceUntil <= now) {
      const stillThere = await db.roomMember.count({
        where: { roomId: room.id, state: "JOINED", userId: { not: room.hostId } },
      });
      if (stillThere > 0) {
        await handOverHost(room, room.hostId);
        out.handedOver += 1;
      }
    }

    // Nobody connected for five minutes, or the room ran its full length.
    const present = await db.roomMember.count({ where: { roomId: room.id, state: "JOINED" } });
    if (present === 0) {
      const since = room.emptySince ?? now;
      if (!room.emptySince) {
        await db.room.update({ where: { id: room.id }, data: { emptySince: now } });
      } else if (now.getTime() - since.getTime() >= LIMITS.ROOM_EMPTY_SWEEP_MIN * 60_000) {
        await finishRoom(room, null);
        out.ended += 1;
        continue;
      }
    } else if (room.emptySince) {
      await db.room.update({ where: { id: room.id }, data: { emptySince: null } });
    }
    const started = room.startedAt ?? room.createdAt;
    const ageMs = now.getTime() - started.getTime();
    const maxMs = LIMITS.ROOM_MAX_DURATION_HOURS * 3_600_000;
    if (ageMs >= maxMs) {
      await finishRoom(room, null);
      out.ended += 1;
    } else if (ageMs >= maxMs - 15 * 60_000 && !room.longWarnedAt) {
      await db.room.update({ where: { id: room.id }, data: { longWarnedAt: now } });
      const people = room.members.filter(
        (m) => m.userId === room.hostId || (m.role === "MODERATOR" && m.state === "JOINED"),
      );
      for (const p of people) {
        void notify({
          userId: p.userId,
          type: "SYSTEM",
          payload: {
            title: "Your room ends in 15 minutes",
            body: `${room.title} reaches the longest a room can run. Start a new one to keep talking.`,
          },
          dedupeKey: `room-long:${room.id}`,
        }).catch(() => null);
      }
      void publish({ type: "room", roomId: room.id, change: "settings" });
    }
  }
  return out;
}

/** A scheduled room whose host never came is cancelled after a grace period, and the people on its list are told. */
export const cancelNoShowRooms = cancelNoShowRoomsImpl;
