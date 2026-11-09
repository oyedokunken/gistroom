import { getDb, type User } from "@gistroom/db";
import {
  errors,
  liveKitIdentity,
  presentationFromColumns,
  presentationReducer,
  presentationRules,
  presentationToColumns,
  type PresentAction,
  type PresentChange,
  type PresentDenied,
  type PresentPerson,
  type PresentRole,
  type PresentScope,
  type PresentSession,
  type PresentationColumns,
  type PresentationDto,
  type PresentationEvent,
  type PresentationResult,
  type PresentationState,
  type RoomMemberState,
} from "@gistroom/shared";
import { AppError, forbidden, notFound } from "./http";
import { grantPublishSources, type PublishSource } from "./livekit";
import { logger } from "./logger";
import { enforce, policies } from "./rate-limit";
import { publish } from "./realtime";
import { loadBySlug, log, memberOf, publishSources, roleIn } from "./rooms/core";

/**
 * Screen sharing, the server side (D100 to D104). Postgres holds who presents (`presenterId`), claimed with a
 * conditional update so two people can never both win. LiveKit holds the track: the screen share source is not in any
 * token, the server grants it to the presenter and takes it back, so a browser that skips this module cannot publish.
 * Socket events are hints. Nothing here reads, stores or logs what is on the shared screen or what it is called.
 */

interface Subject {
  scope: PresentScope;
  /** The call id, or the room id. */
  id: string;
  /** The call id, or the room slug, as the tab knows it. */
  ref: string;
  livekitRoom: string;
  viewerRole: PresentRole | null;
  memberState: RoomMemberState | null;
  session: PresentSession;
  locked: boolean;
  columns: PresentationColumns;
  /** Both people of a call, or null for a room. */
  pair: [string, string] | null;
}

type Target = Pick<Subject, "scope" | "id" | "livekitRoom">;

const pick = (row: PresentationColumns): PresentationColumns => ({
  presenterId: row.presenterId,
  presentRequesterId: row.presentRequesterId,
  presentRequestedAt: row.presentRequestedAt,
  presentHandoffAt: row.presentHandoffAt,
});

async function loadSubject(scope: PresentScope, ref: string, me: User): Promise<Subject> {
  const db = getDb();
  if (scope === "call") {
    const call = await db.call.findUnique({ where: { id: ref } });
    if (!call || (call.callerId !== me.id && call.calleeId !== me.id)) throw notFound();
    return {
      scope,
      id: call.id,
      ref: call.id,
      livekitRoom: call.livekitRoom,
      viewerRole: call.callerId === me.id ? "CALLER" : "CALLEE",
      memberState: null,
      session:
        call.status === "ACTIVE" ? "LIVE" : call.status === "RINGING" ? "NOT_STARTED" : "ENDED",
      locked: false,
      columns: pick(call),
      pair: [call.callerId, call.calleeId],
    };
  }
  const room = await loadBySlug(ref);
  const member = await memberOf(room.id, me.id);
  const isHost = room.hostId === me.id;
  return {
    scope,
    id: room.id,
    ref: room.slug,
    livekitRoom: room.livekitRoom,
    viewerRole: isHost ? "HOST" : (member?.role ?? null),
    memberState: member?.state ?? (isHost ? "JOINED" : null),
    session:
      room.status === "LIVE" ? "LIVE" : room.status === "SCHEDULED" ? "NOT_STARTED" : "ENDED",
    locked: room.locked,
    columns: pick(room),
    pair: null,
  };
}

/** Is the person still inside the call or room. A presenter who dropped, left or was removed is not. */
async function isInside(subject: Subject, userId: string): Promise<boolean> {
  if (subject.pair) return subject.pair.includes(userId) && subject.session === "LIVE";
  if (subject.session !== "LIVE") return false;
  const m = await getDb().roomMember.findUnique({
    where: { roomId_userId: { roomId: subject.id, userId } },
    select: { state: true },
  });
  return m?.state === "JOINED";
}

async function presenterRoleOf(
  subject: Subject,
  presenterId: string | null,
): Promise<PresentRole | null> {
  if (!presenterId) return null;
  if (subject.pair) return presenterId === subject.pair[0] ? "CALLER" : "CALLEE";
  const room = await getDb().room.findUnique({ where: { id: subject.id } });
  return room ? await roleIn(room, presenterId) : null;
}

async function personOf(id: string | null): Promise<PresentPerson | null> {
  if (!id) return null;
  const user = await getDb().user.findUnique({ where: { id }, select: { id: true, name: true } });
  return user ? { id: user.id, name: user.name } : null;
}

async function write(
  subject: Target,
  expected: PresentationColumns,
  next: PresentationColumns,
): Promise<boolean> {
  const where = { id: subject.id, ...expected };
  const done =
    subject.scope === "call"
      ? await getDb().call.updateMany({ where, data: next })
      : await getDb().room.updateMany({ where, data: next });
  return done.count === 1;
}

async function reload(subject: Subject): Promise<PresentationColumns> {
  const db = getDb();
  const row =
    subject.scope === "call"
      ? await db.call.findUnique({ where: { id: subject.id } })
      : await db.room.findUnique({ where: { id: subject.id } });
  if (!row) throw notFound();
  return pick(row);
}

/**
 * Runs one event through the reducer and saves it only if nobody else changed the row meanwhile, so two people who
 * start at the same moment cannot both become the presenter. A presenter who is no longer inside is dropped first.
 */
async function transition(
  subject: Subject,
  build: (current: PresentationState, now: number) => PresentationEvent,
  guard?: (current: PresentationState, now: number) => boolean,
): Promise<{ result: PresentationResult; changed: boolean }> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const now = Date.now();
    const before = subject.columns;
    let state = presentationFromColumns(before);
    if (state.presenterId && !(await isInside(subject, state.presenterId))) {
      const dropped = presentationReducer(state, { type: "stop", cause: "cleanup" });
      state = dropped.state;
      await revokeScreen(subject, dropped.previousPresenterId);
    }
    if (guard && !guard(state, now)) {
      return {
        result: { state, outcome: "unchanged", previousPresenterId: null, requesterId: null },
        changed: false,
      };
    }
    const result = presentationReducer(state, build(state, now));
    const nextColumns = presentationToColumns(result.state);
    const same =
      before.presenterId === nextColumns.presenterId &&
      before.presentRequesterId === nextColumns.presentRequesterId &&
      before.presentRequestedAt?.getTime() === nextColumns.presentRequestedAt?.getTime() &&
      before.presentHandoffAt?.getTime() === nextColumns.presentHandoffAt?.getTime();
    if (same) return { result, changed: false };
    if (await write(subject, before, nextColumns)) {
      subject.columns = nextColumns;
      return { result, changed: true };
    }
    subject.columns = await reload(subject);
  }
  throw new AppError(409, "CONFLICT", errors.presentBusy);
}

async function baseSources(subject: Target, userId: string): Promise<PublishSource[]> {
  if (subject.scope === "call") return ["microphone", "camera"];
  const room = await getDb().room.findUnique({ where: { id: subject.id } });
  if (!room) return [];
  return publishSources(room, await roleIn(room, userId));
}

async function grantScreen(subject: Target, userId: string): Promise<boolean> {
  const base = await baseSources(subject, userId);
  return grantPublishSources(subject.livekitRoom, liveKitIdentity(userId), [
    ...base,
    "screen_share",
  ]);
}

/** Takes the screen share permission away. LiveKit then drops the track, so a presentation cannot outlive its turn. */
async function revokeScreen(subject: Target, userId: string | null): Promise<void> {
  if (!userId) return;
  const base = await baseSources(subject, userId);
  await grantPublishSources(subject.livekitRoom, liveKitIdentity(userId), base);
}

const announce = (subject: Pick<Subject, "scope" | "id">, change: PresentChange) =>
  void publish({ type: "presentation", scope: subject.scope, refId: subject.id, change });

/** Lifecycle outcomes only, with ids. Never a source name, a window title or a frame. */
const record = (
  event: "started" | "stopped" | "denied" | "failed",
  subject: Subject,
  userId: string,
  detail?: string,
) =>
  logger.info(
    { presentation: event, scope: subject.scope, session: subject.id, userId, detail },
    "presentation",
  );

function deniedError(reason: PresentDenied): AppError {
  switch (reason) {
    case "ENDED":
      return new AppError(410, "CONFLICT", errors.presentEnded);
    case "BUSY":
    case "HANDOFF_RESERVED":
      return new AppError(409, "CONFLICT", errors.presentBusy);
    default:
      return forbidden(errors.presentNotAllowed);
  }
}

/** What the tab needs to draw the controls and the handoff dialogs. Also drops a presenter who is no longer inside. */
export async function readPresentation(
  me: User,
  scope: PresentScope,
  ref: string,
): Promise<PresentationDto> {
  const subject = await loadSubject(scope, ref, me);
  // Only people inside see who presents. A removed, banned or outside person gets nothing.
  if (!subject.viewerRole || (scope === "room" && subject.memberState !== "JOINED")) {
    throw notFound();
  }
  return dtoOf(subject, me);
}

async function dtoOf(subject: Subject, me: User): Promise<PresentationDto> {
  const now = Date.now();
  let state = presentationFromColumns(subject.columns);
  if (state.presenterId && !(await isInside(subject, state.presenterId))) {
    // Heal the row: the presenter left without telling us. LiveKit already dropped the track.
    const { result } = await transition(subject, () => ({ type: "stop", cause: "cleanup" }));
    state = result.state;
    announce(subject, "stopped");
  } else {
    state = presentationReducer(state, { type: "tick", now }).state;
  }
  const [presenter, requester, handoffTo] = await Promise.all([
    personOf(state.presenterId),
    personOf(state.requesterId),
    personOf(state.handoffToId),
  ]);
  return {
    scope: subject.scope,
    meId: me.id,
    presenter,
    requester,
    requestExpiresAt: state.requestExpiresAt
      ? new Date(state.requestExpiresAt).toISOString()
      : null,
    handoffTo,
    handoffExpiresAt: state.handoffExpiresAt
      ? new Date(state.handoffExpiresAt).toISOString()
      : null,
    serverNow: new Date(now).toISOString(),
  };
}

export async function actOnPresentation(
  me: User,
  scope: PresentScope,
  ref: string,
  action: PresentAction,
): Promise<PresentationDto> {
  await enforce(policies.present, me.id);
  const subject = await loadSubject(scope, ref, me);
  const now = Date.now();
  const current = presentationFromColumns(subject.columns);
  const rules = presentationRules({
    scope,
    role: subject.viewerRole,
    memberState: subject.memberState,
    session: subject.session,
    locked: subject.locked,
    viewerId: me.id,
    state: current,
    presenterRole: await presenterRoleOf(subject, current.presenterId),
    now,
  });
  // A call or room that is over, or a presenter who is gone, is cleaned up by `transition` before the event applies.
  const deny = (reason: PresentDenied | null): never => {
    record("denied", subject, me.id, action);
    throw reason ? deniedError(reason) : forbidden(errors.presentNotAllowed);
  };

  // Someone who may not stop, cancel or take over is simply not allowed. "Busy" would hint at a turn they can take.
  const notMine = (reason: PresentDenied | null): PresentDenied | null =>
    reason === "BUSY" || reason === "HANDOFF_RESERVED" ? null : reason;

  switch (action) {
    case "start": {
      if (!rules.canStart) deny(rules.denied ?? "BUSY");
      const { result } = await transition(subject, (_s, at) => ({
        type: "start",
        by: me.id,
        now: at,
      }));
      if (result.outcome === "busy" || result.outcome === "handoff-reserved") deny("BUSY");
      if (!(await grantScreen(subject, me.id))) {
        await transition(subject, () => ({ type: "stop", cause: "self", userId: me.id }));
        record("failed", subject, me.id, "grant");
        throw new AppError(503, "SERVER", errors.presentUnavailable);
      }
      record("started", subject, me.id);
      announce(subject, "started");
      break;
    }
    case "stop": {
      if (!rules.canStopOwn) deny(notMine(rules.denied));
      const { result } = await transition(subject, () => ({
        type: "stop",
        cause: "self",
        userId: me.id,
      }));
      await revokeScreen(subject, result.previousPresenterId ?? me.id);
      record("stopped", subject, me.id, "self");
      announce(subject, "stopped");
      break;
    }
    case "force-stop": {
      if (scope !== "room" || !rules.canForceStop) deny(notMine(rules.denied));
      const { result } = await transition(subject, () => ({ type: "stop", cause: "moderator" }));
      if (result.previousPresenterId) {
        await revokeScreen(subject, result.previousPresenterId);
        await log(subject.id, me.id, "PRESENT_STOP", result.previousPresenterId);
        record("stopped", subject, result.previousPresenterId, "moderator");
        announce(subject, "force-ended");
      }
      break;
    }
    case "take-over": {
      if (scope !== "room" || !rules.canTakeOver) deny(notMine(rules.denied));
      const { result } = await transition(subject, () => ({ type: "take-over", by: me.id }));
      await revokeScreen(subject, result.previousPresenterId);
      if (!(await grantScreen(subject, me.id))) {
        await transition(subject, () => ({ type: "stop", cause: "self", userId: me.id }));
        record("failed", subject, me.id, "grant");
        throw new AppError(503, "SERVER", errors.presentUnavailable);
      }
      if (result.previousPresenterId) {
        await log(subject.id, me.id, "PRESENT_STOP", result.previousPresenterId, {
          takeover: true,
        });
      }
      record("started", subject, me.id, "takeover");
      announce(subject, "force-ended");
      break;
    }
    case "request": {
      if (!rules.canAsk) deny(rules.denied === "BUSY" ? "BUSY" : rules.denied);
      const { result } = await transition(subject, (_s, at) => ({
        type: "request",
        by: me.id,
        now: at,
      }));
      if (result.outcome === "request-taken") {
        throw new AppError(409, "CONFLICT", errors.presentRequestTaken);
      }
      announce(subject, "requested");
      break;
    }
    case "cancel-request": {
      if (!rules.canCancelAsk) deny(notMine(rules.denied));
      await transition(subject, () => ({ type: "cancel-request", by: me.id }));
      announce(subject, "denied");
      break;
    }
    case "accept":
    case "decline": {
      if (!rules.canAnswerRequest) throw new AppError(409, "CONFLICT", errors.presentNoRequest);
      const { result } = await transition(subject, (_s, at) =>
        action === "accept"
          ? { type: "accept", by: me.id, now: at }
          : { type: "decline", by: me.id },
      );
      if (action === "accept") {
        await revokeScreen(subject, result.previousPresenterId);
        record("stopped", subject, me.id, "handoff");
        announce(subject, "handed");
      } else {
        announce(subject, "denied");
      }
      break;
    }
  }
  return dtoOf(await loadSubject(scope, ref, me), me);
}

/** Called when a person leaves, is removed or banned, or a session ends. Their turn ends and the permission goes. */
export async function releasePresenter(
  scope: PresentScope,
  id: string,
  userId: string | null,
  cause: "left" | "removed" | "session-ended",
): Promise<void> {
  const db = getDb();
  const row =
    scope === "call"
      ? await db.call.findUnique({ where: { id } })
      : await db.room.findUnique({ where: { id } });
  if (!row?.presenterId) return;
  if (userId !== null && row.presenterId !== userId) return;
  const state = presentationFromColumns(pick(row));
  const next = presentationReducer(
    state,
    cause === "session-ended"
      ? { type: "stop", cause }
      : { type: "stop", cause, userId: row.presenterId },
  );
  const subject: Target = { scope, id, livekitRoom: row.livekitRoom };
  const done = await write(subject, pick(row), presentationToColumns(next.state));
  if (!done) return;
  if (cause !== "session-ended") {
    await revokeScreen(subject, next.previousPresenterId).catch(() => undefined);
  }
  logger.info(
    { presentation: "stopped", scope, session: id, userId: row.presenterId, detail: cause },
    "presentation",
  );
  announce(subject, "stopped");
}
