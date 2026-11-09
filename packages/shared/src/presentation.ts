import { z } from "zod";
import { LIMITS } from "./limits";
import type { RoomMemberState, RoomRole } from "./rooms";

/**
 * Screen sharing rules (D100 to D104), shared by the server and the browser. Pure, so the whole matrix and every state
 * change is unit tested. Postgres holds the presenter, LiveKit holds the track, and socket events are only hints.
 * Nothing here ever holds the shared source: no window title, no tab name, no pixels.
 */

export type PresentScope = "call" | "room";
export type PresentRole = "CALLER" | "CALLEE" | RoomRole;
export type PresentSession = "LIVE" | "NOT_STARTED" | "ENDED";

export const PRESENT_SCOPES = ["call", "room"] as const;

/** Why the presentation control is not available. */
export type PresentDenied =
  "ENDED" | "NOT_STARTED" | "NOT_IN" | "REMOVED" | "BANNED" | "BUSY" | "HANDOFF_RESERVED";

export interface PresentRulesInput {
  scope: PresentScope;
  /** The viewer's place in the call or room, or null when they have none. */
  role: PresentRole | null;
  /** Rooms only. A call has two people and no member list, so pass null for a call. */
  memberState: RoomMemberState | null;
  session: PresentSession;
  /** A lock only decides who may enter. People already inside keep their right to present (D103). */
  locked: boolean;
  viewerId: string;
  state: PresentationState;
  /** The role of the person presenting, so a moderator never acts on the host. */
  presenterRole: PresentRole | null;
  now: number;
}

export interface PresentRules {
  canStart: boolean;
  /** Why starting is not possible, null when it is. */
  denied: PresentDenied | null;
  /** Someone else presents, the viewer may politely ask for the next turn. */
  canAsk: boolean;
  canCancelAsk: boolean;
  /** The viewer is the presenter and someone is asking for their turn. */
  canAnswerRequest: boolean;
  canStopOwn: boolean;
  /** Rooms only: the host or a moderator may end someone else's presentation. */
  canForceStop: boolean;
  /** Rooms only: stop the current presenter and start in one deliberate step. */
  canTakeOver: boolean;
}

const none: Omit<PresentRules, "denied"> = {
  canStart: false,
  canAsk: false,
  canCancelAsk: false,
  canAnswerRequest: false,
  canStopOwn: false,
  canForceStop: false,
  canTakeOver: false,
};

export function presentationRules(input: PresentRulesInput): PresentRules {
  const { viewerId } = input;
  const gate = (): PresentDenied | null => {
    if (input.session === "ENDED") return "ENDED";
    if (input.session === "NOT_STARTED") return "NOT_STARTED";
    if (!input.role) return "NOT_IN";
    if (input.memberState === "BANNED") return "BANNED";
    if (input.memberState === "REMOVED") return "REMOVED";
    if (input.memberState !== null && input.memberState !== "JOINED") return "NOT_IN";
    return null;
  };
  const blocked = gate();
  if (blocked || !input.role) return { ...none, denied: blocked ?? "NOT_IN" };

  const state = settle(input.state, input.now);
  const role = input.role;
  const privileged = input.scope === "room" && (role === "HOST" || role === "MODERATOR");
  const presenter = state.presenterId;

  if (presenter === viewerId) {
    return {
      ...none,
      denied: null,
      canStopOwn: true,
      canAnswerRequest: state.requesterId !== null,
    };
  }
  if (presenter === null) {
    const reserved = state.handoffToId !== null && state.handoffToId !== viewerId;
    return reserved
      ? { ...none, denied: "HANDOFF_RESERVED" }
      : { ...none, denied: null, canStart: true };
  }
  const target = input.presenterRole;
  // Nobody acts on the host, and a moderator acts on members only (the same rule as every other room action).
  const canForce =
    privileged && (role === "HOST" ? target !== "HOST" : target === "MEMBER" || target === null);
  return {
    ...none,
    denied: "BUSY",
    canAsk: state.requesterId === null,
    canCancelAsk: state.requesterId === viewerId,
    canForceStop: canForce,
    canTakeOver: canForce,
  };
}

// ---------- The presentation state machine ----------

export interface PresentationState {
  presenterId: string | null;
  requesterId: string | null;
  /** Milliseconds since 1970 when the request lapses. */
  requestExpiresAt: number | null;
  handoffToId: string | null;
  handoffExpiresAt: number | null;
}

export const noPresentation: PresentationState = {
  presenterId: null,
  requesterId: null,
  requestExpiresAt: null,
  handoffToId: null,
  handoffExpiresAt: null,
};

export type StopCause =
  | "self"
  | "browser"
  | "disconnect"
  | "left"
  | "removed"
  | "moderator"
  | "session-ended"
  | "cleanup";

/** Causes that name one person. They only count when that person is the presenter. */
const PERSONAL_CAUSES: ReadonlySet<StopCause> = new Set([
  "self",
  "browser",
  "disconnect",
  "left",
  "removed",
]);

export type PresentationEvent =
  | { type: "start"; by: string; now: number }
  | { type: "stop"; cause: StopCause; userId?: string }
  | { type: "request"; by: string; now: number }
  | { type: "cancel-request"; by: string }
  | { type: "accept"; by: string; now: number }
  | { type: "decline"; by: string }
  | { type: "take-over"; by: string }
  | { type: "tick"; now: number };

export type PresentationOutcome =
  | "started"
  | "busy"
  | "handoff-reserved"
  | "stopped"
  | "not-presenter"
  | "requested"
  | "request-taken"
  | "request-cancelled"
  | "handed"
  | "denied"
  | "no-request"
  | "taken"
  | "expired"
  | "unchanged";

export interface PresentationResult {
  state: PresentationState;
  outcome: PresentationOutcome;
  /** Who lost the turn, so the server can take the screen share permission away from them. */
  previousPresenterId: string | null;
  /** The person whose request was answered, so they can be told. */
  requesterId: string | null;
}

/** Forget a request or a handoff that ran out. */
export function settle(state: PresentationState, now: number): PresentationState {
  let next = state;
  if (next.requestExpiresAt !== null && next.requestExpiresAt <= now) {
    next = { ...next, requesterId: null, requestExpiresAt: null };
  }
  if (next.handoffExpiresAt !== null && next.handoffExpiresAt <= now) {
    next = { ...next, handoffToId: null, handoffExpiresAt: null };
  }
  return next;
}

const result = (
  state: PresentationState,
  outcome: PresentationOutcome,
  extra: Partial<Pick<PresentationResult, "previousPresenterId" | "requesterId">> = {},
): PresentationResult => ({
  state,
  outcome,
  previousPresenterId: extra.previousPresenterId ?? null,
  requesterId: extra.requesterId ?? null,
});

/** Who may do what is decided by `presentationRules`. The reducer only keeps the one presenter honest. */
export function presentationReducer(
  current: PresentationState,
  event: PresentationEvent,
): PresentationResult {
  const state = "now" in event ? settle(current, event.now) : current;
  const expired = state !== current;

  switch (event.type) {
    case "tick":
      return result(state, expired ? "expired" : "unchanged");

    case "start": {
      if (state.presenterId === event.by) return result(state, "unchanged");
      if (state.presenterId !== null) return result(state, "busy");
      if (state.handoffToId !== null && state.handoffToId !== event.by) {
        return result(state, "handoff-reserved");
      }
      return result({ ...noPresentation, presenterId: event.by }, "started");
    }

    case "stop": {
      const presenter = state.presenterId;
      if (presenter === null) return result(state, "unchanged");
      if (PERSONAL_CAUSES.has(event.cause) && event.userId !== presenter) {
        return result(state, "not-presenter");
      }
      // A session that ended or was cleaned up also forgets every request and handoff.
      const wipe = event.cause === "session-ended" || event.cause === "cleanup";
      return result(
        wipe
          ? noPresentation
          : { ...state, presenterId: null, requesterId: null, requestExpiresAt: null },
        "stopped",
        { previousPresenterId: presenter },
      );
    }

    case "request": {
      if (state.presenterId === null || state.presenterId === event.by) {
        return result(state, "unchanged");
      }
      if (state.requesterId !== null && state.requesterId !== event.by) {
        return result(state, "request-taken");
      }
      return result(
        {
          ...state,
          requesterId: event.by,
          requestExpiresAt: event.now + LIMITS.PRESENT_REQUEST_TTL_SEC * 1000,
        },
        "requested",
        { requesterId: event.by },
      );
    }

    case "cancel-request": {
      if (state.requesterId !== event.by) return result(state, "no-request");
      return result({ ...state, requesterId: null, requestExpiresAt: null }, "request-cancelled", {
        requesterId: event.by,
      });
    }

    case "accept": {
      const asker = state.requesterId;
      if (state.presenterId !== event.by) return result(state, "not-presenter");
      if (asker === null) return result(state, "no-request");
      return result(
        {
          presenterId: null,
          requesterId: null,
          requestExpiresAt: null,
          handoffToId: asker,
          handoffExpiresAt: event.now + LIMITS.PRESENT_HANDOFF_SEC * 1000,
        },
        "handed",
        { previousPresenterId: event.by, requesterId: asker },
      );
    }

    case "decline": {
      const asker = state.requesterId;
      if (state.presenterId !== event.by) return result(state, "not-presenter");
      if (asker === null) return result(state, "no-request");
      return result({ ...state, requesterId: null, requestExpiresAt: null }, "denied", {
        requesterId: asker,
      });
    }

    case "take-over": {
      const previous = state.presenterId;
      if (previous === event.by) return result(state, "unchanged");
      return result({ ...noPresentation, presenterId: event.by }, "taken", {
        previousPresenterId: previous,
      });
    }
  }
}

// ---------- Wire contracts ----------

export const PRESENT_ACTIONS = [
  "start",
  "stop",
  "request",
  "cancel-request",
  "accept",
  "decline",
  "take-over",
  "force-stop",
] as const;
export type PresentAction = (typeof PRESENT_ACTIONS)[number];

export const presentActionSchema = z.object({ action: z.enum(PRESENT_ACTIONS) });
export type PresentActionInput = z.infer<typeof presentActionSchema>;

export interface PresentPerson {
  id: string;
  name: string;
}

/** What the server tells a tab about the presentation. Names only, never a source name or a title. */
export interface PresentationDto {
  scope: PresentScope;
  /** The person asking, so a tab does not have to work out who it is. */
  meId: string;
  presenter: PresentPerson | null;
  requester: PresentPerson | null;
  requestExpiresAt: string | null;
  handoffTo: PresentPerson | null;
  handoffExpiresAt: string | null;
  /** The server clock, so a countdown is right on a device with a wrong clock. */
  serverNow: string;
}

/** What changed, sent as a hint to everyone in the call or room. They refetch the state. */
export const PRESENT_CHANGES = [
  "started",
  "stopped",
  "requested",
  "handed",
  "denied",
  "force-ended",
] as const;
export type PresentChange = (typeof PRESENT_CHANGES)[number];

export function presentationFromDto(dto: PresentationDto, clockOffsetMs = 0): PresentationState {
  const at = (iso: string | null) => (iso ? new Date(iso).getTime() + clockOffsetMs : null);
  return {
    presenterId: dto.presenter?.id ?? null,
    requesterId: dto.requester?.id ?? null,
    requestExpiresAt: at(dto.requestExpiresAt),
    handoffToId: dto.handoffTo?.id ?? null,
    handoffExpiresAt: at(dto.handoffExpiresAt),
  };
}

// ---------- Quality ----------

export interface PresentQuality {
  width: number;
  height: number;
  frameRate: number;
  /** A person on data saver or a weak line shares at this lower size. */
  reduced: boolean;
}

export const PRESENT_QUALITY_FULL: PresentQuality = {
  width: 1920,
  height: 1080,
  frameRate: 15,
  reduced: false,
};
export const PRESENT_QUALITY_REDUCED: PresentQuality = {
  width: 960,
  height: 540,
  frameRate: 5,
  reduced: true,
};

export const presentQuality = (reduced: boolean): PresentQuality =>
  reduced ? PRESENT_QUALITY_REDUCED : PRESENT_QUALITY_FULL;

/** Most phone browsers cannot share a screen. Touch devices without the API are told so up front. */
export function canCaptureScreen(env: {
  hasGetDisplayMedia: boolean;
  isSecureContext: boolean;
  coarsePointer: boolean;
}): { ok: true } | { ok: false; reason: "UNSUPPORTED" | "MOBILE" | "INSECURE" } {
  if (!env.isSecureContext) return { ok: false, reason: "INSECURE" };
  if (!env.hasGetDisplayMedia) {
    return { ok: false, reason: env.coarsePointer ? "MOBILE" : "UNSUPPORTED" };
  }
  return { ok: true };
}

// ---------- Database columns ----------

/** The four columns on Call and Room. A handoff reuses the requester column for the person it is reserved for. */
export interface PresentationColumns {
  presenterId: string | null;
  presentRequesterId: string | null;
  presentRequestedAt: Date | null;
  presentHandoffAt: Date | null;
}

export function presentationFromColumns(cols: PresentationColumns): PresentationState {
  const who = cols.presentRequesterId;
  if (who !== null && cols.presentHandoffAt !== null) {
    return {
      presenterId: cols.presenterId,
      requesterId: null,
      requestExpiresAt: null,
      handoffToId: who,
      handoffExpiresAt: cols.presentHandoffAt.getTime() + LIMITS.PRESENT_HANDOFF_SEC * 1000,
    };
  }
  if (who !== null && cols.presentRequestedAt !== null) {
    return {
      presenterId: cols.presenterId,
      requesterId: who,
      requestExpiresAt: cols.presentRequestedAt.getTime() + LIMITS.PRESENT_REQUEST_TTL_SEC * 1000,
      handoffToId: null,
      handoffExpiresAt: null,
    };
  }
  return { ...noPresentation, presenterId: cols.presenterId };
}

export function presentationToColumns(state: PresentationState): PresentationColumns {
  if (state.handoffToId !== null && state.handoffExpiresAt !== null) {
    return {
      presenterId: state.presenterId,
      presentRequesterId: state.handoffToId,
      presentRequestedAt: null,
      presentHandoffAt: new Date(state.handoffExpiresAt - LIMITS.PRESENT_HANDOFF_SEC * 1000),
    };
  }
  if (state.requesterId !== null && state.requestExpiresAt !== null) {
    return {
      presenterId: state.presenterId,
      presentRequesterId: state.requesterId,
      presentRequestedAt: new Date(state.requestExpiresAt - LIMITS.PRESENT_REQUEST_TTL_SEC * 1000),
      presentHandoffAt: null,
    };
  }
  return {
    presenterId: state.presenterId,
    presentRequesterId: null,
    presentRequestedAt: null,
    presentHandoffAt: null,
  };
}
