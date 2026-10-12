import { getDb, type User } from "@gistroom/db";
import { TOPICS, channelsFor, defaultPrefs } from "@gistroom/shared";
import { loadPrefs, notify } from "../notifications/service";
import { sendTemplate } from "./send";

/**
 * Email that follows a notification. Each one honours the person's own switches and quiet hours, and a failure
 * never blocks the thing that caused it (Section 19). Security mail does not live here.
 */

const REMINDER_LEAD_MS = 15 * 60_000;

/** "Today, 7:30 PM" in the person's own zone, 12 hour with AM or PM. */
export function whenText(date: Date, timeZone: string, now = new Date()): string {
  const zone = (() => {
    try {
      new Intl.DateTimeFormat("en-NG", { timeZone });
      return timeZone;
    } catch {
      return "Africa/Lagos";
    }
  })();
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, dateStyle: "short" }).format(d);
  if (dayKey(date) === dayKey(now)) return `Today, ${clock}`;
  const day = new Intl.DateTimeFormat("en-NG", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return `${day}, ${clock}`;
}

/** Who may get an email of this type right now. Null when switched off, in quiet hours or not an active account. */
async function recipient(
  userId: string,
  type: Parameters<typeof channelsFor>[0]["type"],
): Promise<{ email: string; name: string; timezone: string } | null> {
  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, status: true, timezone: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  const prefs = await loadPrefs(userId).catch(() => defaultPrefs);
  const channels = channelsFor({ type, prefs, timeZone: user.timezone, now: new Date() });
  return channels.email ? { email: user.email, name: user.name, timezone: user.timezone } : null;
}

interface RoomFacts {
  id: string;
  slug: string;
  title: string;
  topicName: string | null;
  hostName: string;
  scheduledFor: Date | null;
  status: string;
}

export async function emailRoomInvite(inviter: User, room: RoomFacts, userId: string) {
  const to = await recipient(userId, "ROOM_INVITE");
  if (!to) return;
  await sendTemplate("room-invite", to.email, {
    name: inviter.name,
    to: to.name,
    title: room.title,
    topic: room.topicName,
    host: room.hostName,
    when:
      room.status === "SCHEDULED" && room.scheduledFor
        ? whenText(room.scheduledFor, to.timezone)
        : null,
    path: `/app/rooms/${room.slug}`,
  }).catch(() => undefined);
}

export async function emailRoomEnded(
  hostId: string,
  room: {
    slug: string;
    title: string;
    durationSec: number;
    peak: number;
    attendees: number;
    messages: number;
  },
) {
  const to = await recipient(hostId, "ROOM_ENDED");
  if (!to) return;
  const m = Math.floor(room.durationSec / 60);
  const duration = m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.max(1, m)} min`;
  await sendTemplate("room-ended-summary", to.email, {
    to: to.name,
    title: room.title,
    duration,
    peak: room.peak,
    attendees: room.attendees,
    messages: room.messages,
    path: `/app/rooms/${room.slug}`,
  }).catch(() => undefined);
}

/** After the person picks their topics: a welcome with rooms that match, from real public rooms only. */
export async function emailWelcome(user: User, topicSlugs: string[]) {
  const names = TOPICS.filter((t) => topicSlugs.includes(t.slug)).map((t) => t.slug);
  const rooms = names.length
    ? await getDb().room.findMany({
        where: {
          visibility: "PUBLIC",
          status: { in: ["LIVE", "SCHEDULED"] },
          topic: { slug: { in: names } },
        },
        orderBy: [{ status: "asc" }, { startedAt: "desc" }],
        take: 3,
        select: { slug: true, title: true },
      })
    : [];
  await sendTemplate("welcome", user.email, {
    name: user.name,
    rooms: rooms.map((r) => ({ title: r.title, path: `/app/rooms/${r.slug}` })),
  }).catch(() => undefined);
}

/**
 * Scheduled rooms that start within 15 minutes: one in-app notice and one email to the host and the people on the
 * list, once each. Safe to run often because the dedupe key keeps it to one.
 */
export async function sendRoomReminders(now = new Date()): Promise<number> {
  const db = getDb();
  const due = await db.room.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
    },
    include: {
      host: true,
      topic: { select: { name: true } },
      members: {
        where: { state: { in: ["INVITED", "JOINED", "LEFT"] } },
        select: { userId: true },
      },
    },
    take: 50,
  });
  let sent = 0;
  for (const room of due) {
    const ids = new Set([room.hostId, ...room.members.map((m) => m.userId)]);
    for (const userId of ids) {
      const row = await notify({
        userId,
        type: "ROOM_STARTING",
        payload: { roomId: room.id, roomSlug: room.slug, roomTitle: room.title },
        dedupeKey: `room-starting:${room.id}`,
      }).catch(() => null);
      if (!row) continue;
      sent += 1;
      const to = await recipient(userId, "ROOM_STARTING");
      if (to && room.scheduledFor) {
        await sendTemplate("room-starting-soon", to.email, {
          to: to.name,
          title: room.title,
          when: whenText(room.scheduledFor, to.timezone, now).replace(/^Today, /, ""),
          path: `/app/rooms/${room.slug}`,
        }).catch(() => undefined);
      }
    }
  }
  return sent;
}

/** One email a day to people who switched on email for friend requests, listing the ones still waiting. */
export async function sendFriendDigests(now = new Date()): Promise<number> {
  const db = getDb();
  const since = new Date(now.getTime() - 86_400_000);
  const rows = await db.friendRequest.findMany({
    where: { status: "PENDING", createdAt: { gt: since } },
    include: { requester: true },
    take: 500,
  });
  const byPerson = new Map<string, typeof rows>();
  for (const r of rows) byPerson.set(r.addresseeId, [...(byPerson.get(r.addresseeId) ?? []), r]);
  const day = now.toISOString().slice(0, 10);
  let sent = 0;
  for (const [userId, list] of byPerson) {
    const prefs = await loadPrefs(userId);
    // Friend requests only ever email as a digest, and only when the person switched email on for them.
    if (!prefs.switches["FRIEND_REQUEST_RECEIVED"]?.email) continue;
    const to = await recipient(userId, "FRIEND_REQUEST_RECEIVED");
    if (!to) continue;
    const marker = `digest:${userId}:${day}`;
    const already = await db.scheduledJob.findFirst({
      where: { kind: "digest-sent", payload: { path: ["marker"], equals: marker } },
    });
    if (already) continue;
    await db.scheduledJob.create({
      data: { kind: "digest-sent", dueAt: now, processedAt: now, payload: { marker } },
    });
    await sendTemplate("activity-digest", to.email, {
      to: to.name,
      requests: list
        .slice(0, 20)
        .map((r) => ({ name: r.requester.name, username: r.requester.username })),
    }).catch(() => undefined);
    sent += 1;
  }
  return sent;
}
