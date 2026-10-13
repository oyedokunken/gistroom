import { getDb, toPublicUser, type User } from "@gistroom/db";
import {
  LIMITS,
  inQuietHours,
  roomRingId,
  type ActiveRingsDto,
  type RecentRingDto,
  type RingDto,
} from "@gistroom/shared";
import { loadPrefs } from "../notifications/service";

/** How long an ended ring stays on the `recent` list, so a card can say how it ended. */
const RECENT_MS = 8_000;

/**
 * Everything that is ringing for this person right now, worked out from the database: 1:1 calls that have not rung out
 * and room rings from the last 45 seconds. A reload, a second tab and a missed socket event all land on the same list
 * with the same time left. In quiet hours nothing rings (the call still ends as a missed call and is logged).
 */
export async function activeRings(me: User, now = new Date()): Promise<ActiveRingsDto> {
  const db = getDb();
  const prefs = await loadPrefs(me.id);
  const quiet = inQuietHours(now, me.timezone, prefs.quietStart, prefs.quietEnd);
  const ttl = LIMITS.CALL_RING_TIMEOUT_SEC * 1000;
  const recentSince = new Date(now.getTime() - RECENT_MS);

  const [calls, recentCalls, rooms, recentRooms] = await Promise.all([
    db.call.findMany({
      where: { calleeId: me.id, status: "RINGING", ringExpiresAt: { gt: now } },
      include: { caller: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.call.findMany({
      where: { calleeId: me.id, status: { not: "RINGING" }, updatedAt: { gt: recentSince } },
      include: { caller: true },
      take: 10,
    }),
    db.roomMember.findMany({
      where: {
        userId: me.id,
        ringStatus: "RINGING",
        noRing: false,
        ringedAt: { gt: new Date(now.getTime() - ttl) },
        room: { status: { in: ["LIVE", "ENDED"] } },
      },
      include: {
        room: {
          include: {
            host: true,
            topic: { select: { name: true } },
            members: {
              where: { state: "JOINED" },
              include: { user: true },
              orderBy: { joinedAt: "asc" },
            },
          },
        },
      },
      take: 10,
    }),
    db.roomMember.findMany({
      where: {
        userId: me.id,
        ringedAt: { not: null },
        ringStatus: { not: "RINGING" },
        updatedAt: { gt: recentSince },
      },
      include: { room: { select: { slug: true, status: true, host: true } } },
      take: 10,
    }),
  ]);

  const rings: RingDto[] = [];
  if (!quiet) {
    for (const c of calls) {
      rings.push({
        id: c.id,
        kind: "CALL",
        from: toPublicUser(c.caller),
        media: c.initialMedia === "VIDEO" ? "VIDEO" : "AUDIO",
        startedAt: c.createdAt.toISOString(),
        expiresAt: c.ringExpiresAt.toISOString(),
        callId: c.id,
      });
    }
    for (const m of rooms) {
      if (!m.ringedAt) continue;
      const room = m.room;
      const inviter = m.invitedById
        ? await db.user.findUnique({ where: { id: m.invitedById } })
        : null;
      rings.push({
        id: roomRingId(room.slug, m.ringedAt),
        kind: "ROOM",
        from: toPublicUser(inviter ?? room.host),
        media: room.media === "VIDEO" ? "VIDEO" : "AUDIO",
        startedAt: m.ringedAt.toISOString(),
        expiresAt: new Date(m.ringedAt.getTime() + ttl).toISOString(),
        room: {
          slug: room.slug,
          title: room.title,
          topicName: room.topic?.name ?? null,
          language: room.language,
          visibility: room.visibility,
          status: room.status,
          locked: room.locked,
          hostName: room.host.name,
          media: room.media === "VIDEO" ? "VIDEO" : "AUDIO",
          joined: room.members.length,
          max: room.maxParticipants,
          avatars: room.members.slice(0, 4).map((x) => {
            const u = toPublicUser(x.user);
            return { name: u.name, avatarUrl: u.avatarUrl };
          }),
        },
      });
    }
  }

  const recent: RecentRingDto[] = [];
  for (const c of recentCalls) {
    const outcome =
      c.status === "CANCELLED"
        ? "CANCELLED"
        : c.status === "DECLINED"
          ? "DECLINED_ELSEWHERE"
          : c.status === "MISSED"
            ? "EXPIRED"
            : c.answeredAt
              ? "ANSWERED_ELSEWHERE"
              : null;
    if (outcome) {
      recent.push({ id: c.id, kind: "CALL", outcome, from: toPublicUser(c.caller) });
    }
  }
  for (const m of recentRooms) {
    if (!m.ringedAt) continue;
    const outcome =
      m.room.status === "ENDED"
        ? "ENDED"
        : m.ringStatus === "DECLINED"
          ? "DECLINED_ELSEWHERE"
          : m.ringStatus === "NO_ANSWER"
            ? "EXPIRED"
            : "ANSWERED_ELSEWHERE";
    recent.push({
      id: roomRingId(m.room.slug, m.ringedAt),
      kind: "ROOM",
      outcome,
      from: toPublicUser(m.room.host),
    });
  }

  return { serverNow: now.toISOString(), rings, recent, quiet };
}
