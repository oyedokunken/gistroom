import { getDb, toPublicUser, type User } from "@gistroom/db";
import { type RoomDto, type RoomSummaryDto } from "@gistroom/shared";
import { notFound } from "../http";
import { toDto } from "./core";

// ---------- Summary and past rooms ----------

/** What an ended room leaves behind. Attendees see who was there. Only the host sees moderator actions. */
export async function roomSummary(me: User, slug: string): Promise<RoomSummaryDto> {
  const db = getDb();
  const room = await db.room.findUnique({
    where: { slug },
    include: {
      host: true,
      topic: { select: { name: true, slug: true } },
      members: { include: { user: true } },
    },
  });
  if (!room || room.status !== "ENDED") throw notFound();
  const attendeesRows = room.members.filter((m) => m.joinedAt !== null);
  const attended = attendeesRows.some((m) => m.userId === me.id) || room.hostId === me.id;
  const isHost = room.hostId === me.id;
  if (room.visibility === "PRIVATE" && !attended) throw notFound();
  const started = room.startedAt ?? room.createdAt;
  const ended = room.endedAt ?? started;
  const endLog = await db.roomModLog.findFirst({
    where: { roomId: room.id, action: "END" },
    orderBy: { createdAt: "desc" },
  });
  const endedBy: RoomSummaryDto["endedBy"] = !endLog
    ? "SYSTEM"
    : endLog.actorId === room.hostId
      ? "HOST"
      : "MODERATOR";
  const notes = attended
    ? await db.note.findMany({
        where: { userId: me.id, roomId: room.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  return {
    slug: room.slug,
    title: room.title,
    topicName: room.topic?.name ?? null,
    topicSlug: room.topic?.slug ?? null,
    media: room.media === "VIDEO" ? "VIDEO" : "AUDIO",
    host: toPublicUser(room.host),
    startedAt: room.startedAt?.toISOString() ?? null,
    endedAt: room.endedAt?.toISOString() ?? null,
    durationSec: Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)),
    peakParticipants: room.peakParticipants,
    attendeeCount: attendeesRows.length,
    messageCount: room.messageCount,
    reactionCount: room.reactionCount,
    attendees: attended ? attendeesRows.map((m) => toPublicUser(m.user)) : null,
    endedBy,
    modActionCount: isHost ? await db.roomModLog.count({ where: { roomId: room.id } }) : null,
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
    attended,
  };
}

/** Rooms you attended or hosted that have ended, newest first, with the same summary numbers. */
export async function pastRooms(me: User): Promise<RoomSummaryDto[]> {
  const rows = await getDb().room.findMany({
    where: {
      status: "ENDED",
      OR: [{ hostId: me.id }, { members: { some: { userId: me.id, joinedAt: { not: null } } } }],
    },
    orderBy: { endedAt: "desc" },
    take: 50,
    select: { slug: true },
  });
  const out: RoomSummaryDto[] = [];
  for (const r of rows) out.push(await roomSummary(me, r.slug));
  return out;
}

// ---------- Mine ----------

/** Rooms you host or were invited to that are not over. */
export async function myRooms(me: User): Promise<RoomDto[]> {
  const rows = await getDb().room.findMany({
    where: {
      status: { in: ["LIVE", "SCHEDULED"] },
      OR: [
        { hostId: me.id },
        { members: { some: { userId: me.id, state: { in: ["INVITED", "JOINED", "LEFT"] } } } },
      ],
    },
    include: {
      host: true,
      topic: { select: { slug: true, name: true } },
      members: { where: { userId: me.id } },
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }, { scheduledFor: "asc" }],
    take: 30,
  });
  const now = new Date();
  return Promise.all(
    rows.map((r) => {
      const mine = r.members[0];
      const holdsSeat =
        r.status === "LIVE" &&
        (mine?.state === "JOINED" ||
          (mine?.state === "LEFT" && mine.graceUntil !== null && mine.graceUntil > now));
      return toDto(
        r,
        r.hostId === me.id ? "HOST" : (mine?.role ?? null),
        false,
        Boolean(holdsSeat),
      );
    }),
  );
}
