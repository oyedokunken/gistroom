import { randomUUID } from "node:crypto";
import { callDto, dmKeyOf, getDb, type Call, type Prisma, type User } from "@gistroom/db";
import {
  applyCallAction,
  durationSec,
  errors,
  liveKitIdentity,
  logOutcomeFor,
  roomAvatarSrc,
  resolveGlare,
  ringExpiry,
  type CallAction,
  type CallJoin,
  type CallLogDto,
  type CallStatus,
  type Page,
  type StartCallInput,
} from "@gistroom/shared";
import { toPublicUser } from "@gistroom/db";
import { decodeCursor, encodeCursor } from "../cursor";
import { AppError, conflict, notFound } from "../http";
import { mintJoin } from "../livekit";
import { notify } from "../notifications/service";
import { enforce, policies } from "../rate-limit";
import { publish } from "../realtime";
import { accessFor, assertCanInteract } from "../chat/service";

type CallRow = Call & { caller: User; callee: User };

const include = { caller: true, callee: true } as const;

async function conversationOf(a: string, b: string): Promise<string | null> {
  const row = await getDb().conversation.findUnique({
    where: { dmKey: dmKeyOf(a, b) },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function load(id: string): Promise<CallRow> {
  const row = await getDb().call.findUnique({ where: { id }, include });
  if (!row) throw notFound();
  return row;
}

function participant(row: CallRow, me: User): void {
  if (row.callerId !== me.id && row.calleeId !== me.id) throw notFound();
}

async function dto(row: CallRow, me: User) {
  return callDto(row, me.id, await conversationOf(row.callerId, row.calleeId));
}

/** A token is only given while the call can still be joined. */
async function join(row: CallRow, me: User): Promise<CallJoin> {
  const call = await dto(row, me);
  if (row.status !== "RINGING" && row.status !== "ACTIVE") return { call, token: null, url: null };
  // The callee only gets a token once they answer. Until then the call is just ringing.
  if (row.status === "RINGING" && row.calleeId === me.id) return { call, token: null, url: null };
  const { token, url } = mintJoin({
    identity: liveKitIdentity(me.id),
    name: me.name,
    room: row.livekitRoom,
  });
  return { call, token, url };
}

function logRow(row: CallRow, viewer: "caller" | "callee", status: CallStatus) {
  const outcomeBase = logOutcomeFor(status, row.answeredAt);
  if (!outcomeBase) return null;
  // The person who was called sees a cancelled call as one they missed.
  const outcome = viewer === "callee" && outcomeBase === "CANCELLED" ? "MISSED" : outcomeBase;
  const peer = viewer === "caller" ? row.callee : row.caller;
  const ended = row.endedAt ?? new Date();
  return {
    userId: viewer === "caller" ? row.callerId : row.calleeId,
    kind: "DIRECT" as const,
    direction: viewer === "caller" ? ("OUTGOING" as const) : ("INCOMING" as const),
    outcome,
    mediaType: row.initialMedia,
    peerUserId: peer.id,
    titleSnapshot: peer.name,
    searchText: `${peer.name} ${peer.username}`.toLowerCase(),
    startedAt: row.createdAt,
    durationSec: durationSec(row.answeredAt, ended),
  };
}

/**
 * A line in the middle of the chat: a voice or video call, how long it lasted or how it ended, and when it started.
 * It is a system message, so it never counts as unread and never sends an alert of its own.
 */
async function postCallRecord(row: CallRow, status: CallStatus): Promise<void> {
  const outcome =
    status === "ENDED"
      ? row.answeredAt
        ? "ANSWERED"
        : "MISSED"
      : status === "DECLINED"
        ? "DECLINED"
        : status === "MISSED" || status === "CANCELLED" || status === "BUSY"
          ? "MISSED"
          : null;
  if (!outcome) return;
  const db = getDb();
  const conv = await db.conversation.findUnique({
    where: { dmKey: dmKeyOf(row.callerId, row.calleeId) },
    select: { id: true },
  });
  if (!conv) return;
  const ended = row.endedAt ?? new Date();
  const created = await db.message.upsert({
    where: { senderId_clientId: { senderId: row.callerId, clientId: `call:${row.id}` } },
    create: {
      conversationId: conv.id,
      senderId: row.callerId,
      clientId: `call:${row.id}`,
      type: "SYSTEM",
      body: null,
      meta: {
        kind: "CALL",
        callId: row.id,
        media: row.initialMedia,
        outcome,
        durationSec: outcome === "ANSWERED" ? durationSec(row.answeredAt, ended) : 0,
        startedAt: (row.answeredAt ?? row.createdAt).toISOString(),
        callerId: row.callerId,
      },
    },
    update: {},
  });
  await db.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: created.createdAt },
  });
  void publish({ type: "message:new", messageId: created.id });
}

/**
 * Move a call to a finished state exactly once. The update only succeeds while the call is still in the state
 * we read, so two devices ending it together cannot write two log rows (R17).
 */
async function finish(row: CallRow, next: CallStatus, reason: string): Promise<CallRow> {
  const db = getDb();
  const endedAt = new Date();
  const claimed = await db.call.updateMany({
    where: { id: row.id, status: row.status },
    data: { status: next, endedAt, endReason: reason },
  });
  const fresh = await load(row.id);
  if (claimed.count === 0) return fresh;

  const entries = [logRow(fresh, "caller", next), logRow(fresh, "callee", next)].filter(
    (e): e is NonNullable<typeof e> => e !== null,
  );
  if (entries.length > 0) await db.callLogEntry.createMany({ data: entries });
  await postCallRecord(fresh, next).catch(() => undefined);

  if (next === "MISSED" || next === "CANCELLED") {
    // The ring is over. The callee gets a quiet record in the app, with no second push (the cancel push covers it).
    await notify({
      userId: fresh.calleeId,
      type: "CALL_MISSED",
      payload: {
        callId: fresh.id,
        fromName: fresh.caller.name,
        fromUsername: fresh.caller.username,
        noPush: true,
      },
      dedupeKey: `missed:${fresh.id}`,
    }).catch(() => null);
  }
  void publish({
    type: "call",
    callId: fresh.id,
    change: next === "ENDED" ? "ended" : "cancelled",
  });
  return fresh;
}

async function act(me: User, id: string, action: CallAction): Promise<CallJoin> {
  const row = await load(id);
  participant(row, me);
  const result = applyCallAction(row.status, action, {
    isCaller: row.callerId === me.id,
    now: new Date(),
    ringExpiresAt: row.ringExpiresAt,
  });
  if (!result.ok) {
    // Repeating an action on a finished call is harmless: report the state it is in.
    if (row.status !== "RINGING" && row.status !== "ACTIVE") return join(row, me);
    throw new AppError(409, "CONFLICT", errors.callOver);
  }
  if (result.next === "ACTIVE") {
    const claimed = await getDb().call.updateMany({
      where: { id: row.id, status: "RINGING" },
      data: { status: "ACTIVE", answeredAt: new Date() },
    });
    const fresh = await load(row.id);
    if (claimed.count === 1) void publish({ type: "call", callId: row.id, change: "accepted" });
    return join(fresh, me);
  }
  const reason = action === "TIMEOUT" ? "timeout" : action.toLowerCase();
  return join(await finish(row, result.next, reason), me);
}

export const acceptCall = (me: User, id: string) => act(me, id, "ACCEPT");
export const declineCall = (me: User, id: string) => act(me, id, "DECLINE");
export const cancelCall = (me: User, id: string) => act(me, id, "CANCEL");
export const endCall = (me: User, id: string) => act(me, id, "END");
export const timeoutCall = (me: User, id: string) =>
  act(me, id, "TIMEOUT").catch((e) => {
    // Asking for a timeout too early is not an error worth showing.
    if (e instanceof AppError && e.status === 409) return getCall(me, id);
    throw e;
  });

export async function getCall(me: User, id: string): Promise<CallJoin> {
  const row = await load(id);
  participant(row, me);
  return join(row, me);
}

/** The call that is ringing or active for this person right now, if any. Lets a reopened tab pick it back up. */
export async function currentCall(me: User): Promise<CallJoin | null> {
  const row = await getDb().call.findFirst({
    where: {
      status: { in: ["RINGING", "ACTIVE"] },
      OR: [{ callerId: me.id }, { calleeId: me.id }],
      // A ring that ran out is not current. The sweep will finish it.
      NOT: { status: "RINGING", ringExpiresAt: { lte: new Date() } },
    },
    orderBy: { createdAt: "desc" },
    include,
  });
  return row ? join(row, me) : null;
}

export async function startCall(
  me: User,
  input: StartCallInput,
): Promise<CallJoin & { merged: boolean }> {
  await enforce(policies.callStart, me.id);
  const access = await accessFor(me.id, input.conversationId);
  await assertCanInteract(me.id, access.peerId);
  const db = getDb();

  const callee = await db.user.findUnique({ where: { id: access.peerId } });
  if (!callee || callee.status !== "ACTIVE")
    throw new AppError(403, "FORBIDDEN", errors.chatUnavailable);

  // Glare: they are already calling me, so my call becomes my answer.
  const incoming = await db.call.findFirst({
    where: {
      callerId: callee.id,
      calleeId: me.id,
      status: "RINGING",
      ringExpiresAt: { gt: new Date() },
    },
  });
  const merge = resolveGlare(incoming, me.id, callee.id);
  if (merge) {
    const joined = await acceptCall(me, merge);
    return { ...joined, merged: true };
  }

  const mine = await db.call.findFirst({
    where: {
      status: { in: ["RINGING", "ACTIVE"] },
      OR: [{ callerId: me.id }, { calleeId: me.id }],
      NOT: { status: "RINGING", ringExpiresAt: { lte: new Date() } },
    },
  });
  if (mine) throw conflict(errors.callAlready);

  const now = new Date();
  const onCall = await db.call.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ callerId: callee.id }, { calleeId: callee.id }],
    },
  });
  // Someone sitting in a live room cannot answer either. The caller is told, and the person sees a missed call.
  const inRoom = onCall
    ? null
    : await db.roomMember.findFirst({
        where: { userId: callee.id, state: "JOINED", room: { status: "LIVE" } },
        select: { id: true },
      });
  const busy = onCall ?? inRoom;
  const created = await db.call.create({
    data: {
      callerId: me.id,
      calleeId: callee.id,
      initialMedia: input.media,
      status: busy ? "BUSY" : "RINGING",
      livekitRoom: `call_${randomUUID()}`,
      ringExpiresAt: ringExpiry(now),
      ...(busy ? { endedAt: now, endReason: "busy" } : {}),
    },
    include,
  });

  if (busy) {
    const entries = [logRow(created, "caller", "BUSY")].filter(
      (e): e is NonNullable<typeof e> => e !== null,
    );
    // The person who was busy still gets a missed call entry (Section 9.4).
    const missed = logRow(created, "callee", "BUSY");
    if (missed) entries.push({ ...missed, outcome: "MISSED" });
    await db.callLogEntry.createMany({ data: entries });
    throw conflict(inRoom ? errors.callInRoom : errors.callBusy);
  }

  await db.scheduledJob.create({
    data: {
      kind: "call-timeout",
      dueAt: created.ringExpiresAt,
      payload: { callId: created.id } satisfies Prisma.InputJsonValue,
    },
  });
  void publish({ type: "call", callId: created.id, change: "ringing" });
  return { ...(await join(created, me)), merged: false };
}

/** Finish every call whose ring has run out. Safe to run often, from the sweep or the realtime scheduler. */
export async function expireDueCalls(now = new Date()): Promise<number> {
  const due = await getDb().call.findMany({
    where: { status: "RINGING", ringExpiresAt: { lte: now } },
    include,
    take: 100,
  });
  for (const row of due) await finish(row, "MISSED", "timeout");
  return due.length;
}

// ---------- Call logs ----------

interface LogCursor {
  t: string;
  id: string;
}
const isLogCursor = (v: unknown): v is LogCursor =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as LogCursor).t === "string" &&
  typeof (v as LogCursor).id === "string";

export async function listCallLogs(
  me: User,
  query: {
    media?: "AUDIO" | "VIDEO";
    outcome?: "ANSWERED" | "MISSED" | "DECLINED";
    q?: string;
    limit: number;
    cursor?: string | null;
  },
): Promise<Page<CallLogDto> & { total: number }> {
  const db = getDb();
  const where: Prisma.CallLogEntryWhereInput = {
    userId: me.id,
    ...(query.media ? { mediaType: query.media } : {}),
    ...(query.outcome ? { outcome: query.outcome } : {}),
    ...(query.q ? { searchText: { contains: query.q.toLowerCase(), mode: "insensitive" } } : {}),
  };
  const after = decodeCursor(query.cursor ?? null, isLogCursor);
  const [rows, total] = await Promise.all([
    db.callLogEntry.findMany({
      where: after
        ? {
            AND: [
              where,
              {
                OR: [
                  { startedAt: { lt: new Date(after.t) } },
                  { startedAt: new Date(after.t), id: { lt: after.id } },
                ],
              },
            ],
          }
        : where,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    }),
    db.callLogEntry.count({ where }),
  ]);
  const items = rows.slice(0, query.limit);
  const peerIds = [...new Set(items.map((r) => r.peerUserId).filter((v): v is string => !!v))];
  const peers = peerIds.length ? await db.user.findMany({ where: { id: { in: peerIds } } }) : [];
  const byId = new Map(peers.map((p) => [p.id, p]));
  const roomIds = [...new Set(items.map((r) => r.roomId).filter((v): v is string => !!v))];
  const rooms = roomIds.length
    ? await db.room.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, topic: { select: { slug: true } } },
      })
    : [];
  const topicOf = new Map(rooms.map((r) => [r.id, r.topic?.slug ?? null]));
  const out: CallLogDto[] = [];
  for (const r of items) {
    const peer = r.peerUserId ? byId.get(r.peerUserId) : undefined;
    out.push({
      id: r.id,
      kind: r.kind,
      direction: r.direction,
      outcome: r.outcome,
      media: r.mediaType,
      title: peer ? peer.name : r.titleSnapshot,
      peer: peer ? toPublicUser(peer) : null,
      conversationId: peer ? await conversationOf(me.id, peer.id) : null,
      roomId: r.roomId,
      avatarSrc: r.roomId ? roomAvatarSrc(topicOf.get(r.roomId)) : null,
      startedAt: r.startedAt.toISOString(),
      durationSec: r.durationSec,
    });
  }
  const last = items[items.length - 1];
  return {
    items: out,
    total,
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ t: last.startedAt.toISOString(), id: last.id })
        : null,
  };
}
