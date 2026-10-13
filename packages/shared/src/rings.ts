import type { PublicUser } from "./profile";
import type { Language } from "./limits";
import type { RoomStatus } from "./rooms";

/**
 * A ring is something that wants an answer right now: a 1:1 call, or a host ringing you into a room. The server works out
 * the list (`GET /api/rings/active`) and the tab only draws it, so a reload, a second tab and a missed socket event all
 * show the same thing with the right time left.
 */

export interface RingRoomDto {
  slug: string;
  title: string;
  topicName: string | null;
  language: Language;
  visibility: "PUBLIC" | "PRIVATE";
  status: RoomStatus;
  locked: boolean;
  hostName: string;
  media: "AUDIO" | "VIDEO";
  joined: number;
  max: number;
  /** Up to four people inside, for the small avatar stack. */
  avatars: { name: string; avatarUrl: string | null }[];
}

export interface RingDto {
  /** A call id, or `room:{slug}:{time}` for a room ring. */
  id: string;
  kind: "CALL" | "ROOM";
  from: PublicUser;
  media: "AUDIO" | "VIDEO";
  startedAt: string;
  expiresAt: string;
  callId?: string;
  room?: RingRoomDto;
}

/** How a ring that is no longer on the list ended, for the few seconds the card says so. */
export type RingOutcome =
  "CANCELLED" | "ANSWERED_ELSEWHERE" | "DECLINED_ELSEWHERE" | "EXPIRED" | "ENDED";

export interface RecentRingDto {
  id: string;
  kind: "CALL" | "ROOM";
  outcome: RingOutcome;
  from: PublicUser;
}

export interface ActiveRingsDto {
  /** The server's clock when this was made, so the countdown does not depend on the device clock. */
  serverNow: string;
  rings: RingDto[];
  /** Rings that ended in the last few seconds. */
  recent: RecentRingDto[];
  /** Quiet hours are on: nothing rings, and the missed call is still logged. */
  quiet: boolean;
}

export const roomRingId = (slug: string, ringedAt: Date | number): string =>
  `room:${slug}:${typeof ringedAt === "number" ? ringedAt : ringedAt.getTime()}`;

/** Milliseconds left, measured on the server's clock: the gap between the two clocks is taken out. */
export function ringRemainingMs(input: {
  expiresAt: string;
  serverNow: string;
  /** `Date.now()` on this device at the moment the answer arrived. */
  receivedAt: number;
  now: number;
}): number {
  const skew = new Date(input.serverNow).getTime() - input.receivedAt;
  return Math.max(0, new Date(input.expiresAt).getTime() - (input.now + skew));
}

/** Newest first, and at most `max` cards shown. The rest are counted. */
export function stackRings<T extends { startedAt: string }>(
  rings: readonly T[],
  max = 3,
): { shown: T[]; more: number } {
  const sorted = [...rings].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return { shown: sorted.slice(0, max), more: Math.max(0, sorted.length - max) };
}

/** Why a room ring cannot be joined right now, in the words the card uses. Null means it can. */
export function roomRingBlock(room: RingRoomDto): "ENDED" | "FULL" | "LOCKED" | null {
  if (room.status === "ENDED") return "ENDED";
  if (room.locked) return "LOCKED";
  if (room.joined >= room.max) return "FULL";
  return null;
}
