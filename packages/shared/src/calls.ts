import { z } from "zod";
import { LIMITS } from "./limits";
import type { PublicUser } from "./profile";

/** 1:1 call rules shared by web, realtime and the browser (Section 9.4). Pure, so they are easy to test. */

export type CallStatus =
  "RINGING" | "ACTIVE" | "ENDED" | "MISSED" | "DECLINED" | "CANCELLED" | "BUSY" | "FAILED";
export type CallMedia = "AUDIO" | "VIDEO";
export type CallAction = "ACCEPT" | "DECLINE" | "CANCEL" | "TIMEOUT" | "END";

export const startCallSchema = z.object({
  conversationId: z.string().trim().min(1).max(64),
  media: z.enum(["AUDIO", "VIDEO"]),
});
export type StartCallInput = z.infer<typeof startCallSchema>;

export interface CallDto {
  id: string;
  status: CallStatus;
  media: CallMedia;
  /** Whether the viewer placed the call or received it. */
  direction: "INCOMING" | "OUTGOING";
  /** The other person in the call. */
  peer: PublicUser;
  conversationId: string | null;
  ringExpiresAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  /** Who ended it: the viewer, the other person, or the system (rang out, dropped, blocked). Null while it is on. */
  endedBy: "ME" | "PEER" | "SYSTEM" | null;
  /** For a call I placed that is ringing: false when they have no alerts on and have not been seen lately. */
  peerReachable: boolean | null;
}

export interface CallJoin {
  call: CallDto;
  /** Short lived LiveKit token. Null once the call is over. */
  token: string | null;
  url: string | null;
}

export const isFinished = (s: CallStatus): boolean => s !== "RINGING" && s !== "ACTIVE";

export function ringExpiry(from: Date): Date {
  return new Date(from.getTime() + LIMITS.CALL_RING_TIMEOUT_SEC * 1000);
}

export interface TransitionContext {
  /** The person doing the action is the one who placed the call. */
  isCaller: boolean;
  now: Date;
  ringExpiresAt: Date;
}

export type Transition = { ok: true; next: CallStatus } | { ok: false; reason: "NOT_ALLOWED" };

/**
 * The call state machine. A ringing call can be answered by the callee, declined by the callee, cancelled by
 * the caller or run out of time. An active call ends when either person ends it. Nothing else moves.
 */
export function applyCallAction(
  status: CallStatus,
  action: CallAction,
  ctx: TransitionContext,
): Transition {
  const expired = ctx.now >= ctx.ringExpiresAt;
  if (status === "RINGING") {
    switch (action) {
      case "TIMEOUT":
        return expired ? { ok: true, next: "MISSED" } : { ok: false, reason: "NOT_ALLOWED" };
      case "ACCEPT":
        if (ctx.isCaller) return { ok: false, reason: "NOT_ALLOWED" };
        return expired ? { ok: true, next: "MISSED" } : { ok: true, next: "ACTIVE" };
      case "DECLINE":
        return ctx.isCaller ? { ok: false, reason: "NOT_ALLOWED" } : { ok: true, next: "DECLINED" };
      case "CANCEL":
        return ctx.isCaller
          ? { ok: true, next: "CANCELLED" }
          : { ok: false, reason: "NOT_ALLOWED" };
      case "END":
        return ctx.isCaller ? { ok: true, next: "CANCELLED" } : { ok: true, next: "DECLINED" };
    }
  }
  if (status === "ACTIVE" && action === "END") return { ok: true, next: "ENDED" };
  return { ok: false, reason: "NOT_ALLOWED" };
}

/**
 * When A calls B while B is already ringing A, the two calls become one: A answers B's call.
 * Returns the id of the call to answer, or null when there is no glare.
 */
export function resolveGlare(
  existing: { id: string; callerId: string; calleeId: string; status: CallStatus } | null,
  newCaller: string,
  newCallee: string,
): string | null {
  if (!existing || existing.status !== "RINGING") return null;
  return existing.callerId === newCallee && existing.calleeId === newCaller ? existing.id : null;
}

export type LogOutcome = "ANSWERED" | "MISSED" | "DECLINED" | "CANCELLED" | "BUSY";

/** How a finished call reads in each person's call log. */
export function logOutcomeFor(status: CallStatus, answeredAt: Date | null): LogOutcome | null {
  switch (status) {
    case "ENDED":
      return "ANSWERED";
    case "ACTIVE":
      return answeredAt ? "ANSWERED" : null;
    case "MISSED":
      return "MISSED";
    case "DECLINED":
      return "DECLINED";
    case "CANCELLED":
      return "CANCELLED";
    case "BUSY":
      return "BUSY";
    default:
      return null;
  }
}

export const liveKitRoomName = (callId: string): string => `call_${callId}`;
export const liveKitIdentity = (userId: string): string => `user_${userId}`;

export function durationSec(answeredAt: Date | null, endedAt: Date | null): number {
  if (!answeredAt || !endedAt) return 0;
  return Math.max(0, Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000));
}

export const callLogQuerySchema = z.object({
  media: z.enum(["AUDIO", "VIDEO"]).optional(),
  kind: z.enum(["DIRECT", "ROOM"]).optional(),
  outcome: z.enum(["ANSWERED", "MISSED", "DECLINED"]).optional(),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce
    .number()
    .int()
    .refine((n) => (LIMITS.PAGE_SIZE_OPTIONS as readonly number[]).includes(n))
    .optional(),
  cursor: z.string().max(400).optional(),
});

export interface CallLogDto {
  id: string;
  kind: "DIRECT" | "ROOM";
  direction: "INCOMING" | "OUTGOING" | "NONE";
  outcome: LogOutcome;
  media: "AUDIO" | "VIDEO" | "MIXED";
  title: string;
  peer: PublicUser | null;
  conversationId: string | null;
  roomId: string | null;
  /** A picture for rooms, from their topic. People use `peer.avatarUrl`. */
  avatarSrc?: string | null;
  startedAt: string;
  durationSec: number;
}
