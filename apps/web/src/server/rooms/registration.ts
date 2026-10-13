import { getDb, type Prisma, type Room, type User } from "@gistroom/db";
import { LIMITS } from "@gistroom/shared";
import { isBlockedEitherWay } from "../friends/relations";
import { emailRoom, whenText, type RoomMailFacts } from "../mail/notify-email";
import { recordActivity } from "../notifications/activity";
import { notify } from "../notifications/service";
import { publish } from "../realtime";

/**
 * Registering for a scheduled room: what the person is told, what the host sees, and the reminders that follow.
 * Every notice carries a dedupe key, so a sweep that runs twice, or two servers that run it together, send once.
 * Postgres is the source of truth: the ScheduledJob rows only wake the sweep at the right moment (Section 10.5).
 */

const MIN = 60_000;
const JOB_KINDS = ["room-remind", "room-due", "room-noshow"] as const;

type RoomWithPeople = Room & {
  host: User;
  topic: { slug: string; name: string } | null;
};

const facts = (room: RoomWithPeople): RoomMailFacts => ({
  id: room.id,
  slug: room.slug,
  title: room.title,
  topicName: room.topic?.name ?? null,
  hostName: room.host.name,
  scheduledFor: room.scheduledFor,
});

const roomPayload = (room: Room) => ({
  roomId: room.id,
  roomSlug: room.slug,
  roomTitle: room.title,
});

/** Several nudges inside each window, so one missed poll cannot lose a reminder. The dedupe keys keep it to one. */
function jobTimes(scheduledFor: Date): { kind: (typeof JOB_KINDS)[number]; dueAt: Date }[] {
  const at = (offsetMin: number) => new Date(scheduledFor.getTime() + offsetMin * MIN);
  return [
    { kind: "room-remind", dueAt: at(-LIMITS.ROOM_REMINDER_LEAD_MIN) },
    { kind: "room-remind", dueAt: at(-LIMITS.ROOM_REMINDER_LEAD_MIN + 3) },
    { kind: "room-remind", dueAt: at(-LIMITS.ROOM_REMINDER_LEAD_MIN + 6) },
    { kind: "room-due", dueAt: at(0) },
    { kind: "room-due", dueAt: at(5) },
    { kind: "room-noshow", dueAt: at(LIMITS.ROOM_SCHEDULE_GRACE_MIN) },
    { kind: "room-noshow", dueAt: at(LIMITS.ROOM_SCHEDULE_GRACE_MIN + 5) },
  ];
}

/** Drops the waiting jobs for a room, for example when it moves or is cancelled. */
export async function clearRoomJobs(roomId: string, now = new Date()): Promise<void> {
  await getDb().scheduledJob.updateMany({
    where: {
      processedAt: null,
      kind: { in: [...JOB_KINDS] },
      payload: { path: ["roomId"], equals: roomId },
    },
    data: { processedAt: now },
  });
}

/** Makes sure a scheduled room has its wake up jobs. Safe to call again: it only adds what is missing. */
export async function ensureRoomJobs(room: Room, now = new Date()): Promise<void> {
  if (room.status !== "SCHEDULED" || !room.scheduledFor) return;
  const db = getDb();
  const waiting = await db.scheduledJob.count({
    where: {
      processedAt: null,
      kind: { in: [...JOB_KINDS] },
      payload: { path: ["roomId"], equals: room.id },
    },
  });
  if (waiting > 0) return;
  const jobs = jobTimes(room.scheduledFor).filter((j) => j.dueAt.getTime() > now.getTime() - MIN);
  if (jobs.length === 0) return;
  await db.scheduledJob.createMany({
    data: jobs.map((j) => ({
      kind: j.kind,
      dueAt: j.dueAt,
      payload: { roomId: room.id } satisfies Prisma.InputJsonValue,
    })),
  });
}

/** Replaces the jobs after the time changed. */
export async function resetRoomJobs(room: Room, now = new Date()): Promise<void> {
  await clearRoomJobs(room.id, now);
  await ensureRoomJobs(room, now);
}

/** The people who put their name down and are not inside. The host is never one of them. */
async function registrants(room: Room) {
  const rows = await getDb().roomMember.findMany({
    where: {
      roomId: room.id,
      registeredAt: { not: null },
      state: "INVITED",
      userId: { not: room.hostId },
    },
    select: { userId: true, registeredAt: true },
  });
  const out: { userId: string; registeredAt: Date }[] = [];
  for (const r of rows) {
    // A block between the person and the host cancels the courtesy both ways.
    if (r.registeredAt && !(await isBlockedEitherWay(r.userId, room.hostId))) {
      out.push({ userId: r.userId, registeredAt: r.registeredAt });
    }
  }
  return out;
}

async function zoneOf(userId: string): Promise<string> {
  const u = await getDb().user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return u?.timezone ?? "Africa/Lagos";
}

/** A person just registered. The caller has already checked the rules and written registeredAt. */
export async function onRegistered(room: RoomWithPeople, me: User): Promise<void> {
  const when = room.scheduledFor ? whenText(room.scheduledFor, me.timezone) : null;
  void recordActivity({
    userId: me.id,
    kind: "room-registered",
    text: `You're registered for ${room.title}.${when ? ` It starts ${when}.` : ""}`,
    href: `/app/rooms/${room.slug}`,
  });
  void emailRoom("registered", me.id, facts(room));
  // One row for the host per room: "Ada and 4 others registered". It never pushes or emails.
  await notify({
    userId: room.hostId,
    type: "ROOM_REGISTRATIONS",
    payload: { ...roomPayload(room), names: [me.name], count: 1 },
    dedupeKey: `room-registrations:${room.id}`,
    aggregate: (existing) => {
      const names = Array.isArray(existing["names"]) ? (existing["names"] as string[]) : [];
      const count = typeof existing["count"] === "number" ? existing["count"] : names.length;
      return { ...existing, names: [me.name, ...names].slice(0, 3), count: count + 1 };
    },
  }).catch(() => null);
  await ensureRoomJobs(room);
}

/** Taking the name off cancels what was pending for that person. Past notices stay. */
export async function onUnregistered(room: Room, userId: string): Promise<void> {
  // The dedupe keys stay, so a person who registers again does not get the reminder twice.
  void recordActivity({
    userId,
    kind: "room-unregistered",
    text: `You're no longer registered for ${room.title}.`,
    href: `/app/rooms/${room.slug}`,
  });
}

/** The host started the room: tell the registrants who are not already inside. */
export async function notifyLive(room: RoomWithPeople): Promise<number> {
  let sent = 0;
  for (const r of await registrants(room)) {
    const row = await notify({
      userId: r.userId,
      type: "ROOM_LIVE_NOW",
      payload: roomPayload(room),
      dedupeKey: `room:${room.id}:live:${r.userId}`,
    }).catch(() => null);
    if (!row) continue;
    sent += 1;
    void emailRoom("live", r.userId, facts(room));
  }
  return sent;
}

/** The host moved the room. Old reminders are cancelled, new ones are set, registrants hear the new time. */
export async function notifyRescheduled(room: RoomWithPeople, now = new Date()): Promise<void> {
  const db = getDb();
  await resetRoomJobs(room, now);
  // Let the reminders fire again for the new time.
  await db.notification.updateMany({
    where: { dedupeKey: { startsWith: `room:${room.id}:remind15:` } },
    data: { dedupeKey: null },
  });
  const epoch = room.scheduledFor?.getTime() ?? 0;
  for (const r of await registrants(room)) {
    const when = room.scheduledFor ? whenText(room.scheduledFor, await zoneOf(r.userId), now) : "";
    const row = await notify({
      userId: r.userId,
      type: "ROOM_RESCHEDULED",
      payload: { ...roomPayload(room), when },
      dedupeKey: `room:${room.id}:resched:${r.userId}:${epoch}`,
    }).catch(() => null);
    if (row) void emailRoom("rescheduled", r.userId, facts(room), { now });
  }
}

/** The room will not happen: the host cancelled it, or never came. */
export async function notifyCancelled(
  room: RoomWithPeople,
  reason: "NO_START" | "HOST_CANCELLED",
): Promise<void> {
  await clearRoomJobs(room.id);
  const db = getDb();
  const everyone = await db.roomMember.findMany({
    where: { roomId: room.id, userId: { not: room.hostId }, state: { in: ["INVITED", "LEFT"] } },
    select: { userId: true, registeredAt: true },
  });
  for (const m of everyone) {
    const row = await notify({
      userId: m.userId,
      type: "ROOM_CANCELLED",
      payload: { ...roomPayload(room), reason },
      dedupeKey: `room:${room.id}:cancelled:${m.userId}`,
    }).catch(() => null);
    // Only people who put their name down get the email. The rest of the list sees it in the app.
    if (row && m.registeredAt) void emailRoom("cancelled", m.userId, facts(room), { reason });
  }
  void publish({ type: "room", roomId: room.id, change: "ended" });
}

export interface ScheduleSweep {
  reminded: number;
  dueHosts: number;
  cancelled: number;
}

/**
 * Everything the clock owes: 15 minute reminders, the host's "due now" nudge, and the cancellation of rooms whose host
 * never came. It looks at the rooms, not at the jobs, so a lost job cannot lose a notice. Safe to run any number of times.
 */
export async function processRoomSchedule(now = new Date()): Promise<ScheduleSweep> {
  const db = getDb();
  const result: ScheduleSweep = { reminded: 0, dueHosts: 0, cancelled: 0 };
  const include = { host: true, topic: { select: { slug: true, name: true } } } as const;

  // Reminders: inside the 15 minute lead, and not so late that "live now" would do the job better.
  const lead = LIMITS.ROOM_REMINDER_LEAD_MIN * MIN;
  const late = LIMITS.ROOM_REMINDER_LATE_MIN * MIN;
  const soon = await db.room.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: {
        gt: new Date(now.getTime() + lead - late),
        lte: new Date(now.getTime() + lead),
      },
    },
    include,
    take: 100,
  });
  for (const room of soon) {
    const startsAt = room.scheduledFor;
    if (!startsAt) continue;
    const people = [
      { userId: room.hostId, registeredAt: null as Date | null },
      ...(await registrants(room)),
    ];
    for (const p of people) {
      // Someone who registered with under 15 minutes left was already told when it starts.
      if (p.registeredAt && p.registeredAt.getTime() > startsAt.getTime() - lead) continue;
      const row = await notify({
        userId: p.userId,
        type: "ROOM_STARTING",
        payload: roomPayload(room),
        dedupeKey: `room:${room.id}:remind15:${p.userId}`,
      }).catch(() => null);
      if (!row) continue;
      result.reminded += 1;
      void emailRoom("reminder", p.userId, facts(room), { now });
    }
  }

  // The host's nudge: it is time and the room has not started.
  const due = await db.room.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: {
        lte: now,
        gt: new Date(now.getTime() - LIMITS.ROOM_SCHEDULE_GRACE_MIN * MIN),
      },
    },
    select: { id: true, slug: true, title: true, hostId: true },
    take: 100,
  });
  for (const room of due) {
    const row = await notify({
      userId: room.hostId,
      type: "ROOM_DUE_HOST",
      payload: { roomId: room.id, roomSlug: room.slug, roomTitle: room.title },
      dedupeKey: `room:${room.id}:due:${room.hostId}`,
    }).catch(() => null);
    if (row) result.dueHosts += 1;
  }

  result.cancelled = await cancelNoShowRooms(now);
  return result;
}

/** A scheduled room whose host never came is cancelled after the grace period and its list is told. */
export async function cancelNoShowRooms(
  now = new Date(),
  graceMin: number = LIMITS.ROOM_SCHEDULE_GRACE_MIN,
): Promise<number> {
  const db = getDb();
  const rooms = await db.room.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lt: new Date(now.getTime() - graceMin * MIN) },
    },
    include: { host: true, topic: { select: { slug: true, name: true } } },
    take: 100,
  });
  let done = 0;
  for (const room of rooms) {
    const claimed = await db.room.updateMany({
      where: { id: room.id, status: "SCHEDULED" },
      data: { status: "ENDED", endedAt: now },
    });
    if (claimed.count === 0) continue;
    done += 1;
    await notifyCancelled(room, "NO_START");
  }
  return done;
}
