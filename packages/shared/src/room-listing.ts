import { z } from "zod";
import { LANGUAGES, type Language } from "./limits";
import type { PublicRoomCard } from "./dto";

/**
 * Pure rules for listing rooms, shared by /rooms, Discover and the related rooms list so they cannot drift apart.
 * Everything here works on card data the server already authorized, never on private room facts.
 */

export type RoomSort = "active" | "newest";

type Sortable = Pick<
  PublicRoomCard,
  "status" | "listeners" | "startedAt" | "scheduledFor" | "title" | "slug"
>;

/** Live rooms first (busiest first, or newest first), then upcoming rooms by start time, soonest first. */
export function sortRoomCards<T extends Sortable>(
  cards: readonly T[],
  sort: RoomSort = "active",
): T[] {
  const live = cards.filter((c) => c.status === "LIVE");
  const soon = cards.filter((c) => c.status !== "LIVE");
  const liveOrder =
    sort === "newest"
      ? (a: T, b: T) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
      : (a: T, b: T) =>
          b.listeners - a.listeners ||
          (b.startedAt ?? "").localeCompare(a.startedAt ?? "") ||
          a.title.localeCompare(b.title);
  const soonOrder = (a: T, b: T) =>
    (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999") ||
    a.title.localeCompare(b.title);
  return [
    ...live.sort((a, b) => liveOrder(a, b) || a.slug.localeCompare(b.slug)),
    ...soon.sort((a, b) => soonOrder(a, b) || a.slug.localeCompare(b.slug)),
  ];
}

export type RoomAttendanceStatus = "LIVE" | "SCHEDULED" | "ENDED";

/** "2 in room", "2 attending", "2 attended". The number always comes from the server, never from the browser. */
export function attendanceLabel(status: RoomAttendanceStatus, count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (status === "LIVE") return `${n} in room`;
  if (status === "ENDED") return `${n} attended`;
  return `${n} attending`;
}

/**
 * How long until a start time, in the short form used on room cards: "1 day 2h", "3h 20m", "12m". It is the gap between
 * two instants, so it is the same for a viewer in any time zone. Null when the time is missing or not a date.
 */
export function countdownText(
  startsAt: string | Date | null | undefined,
  now: Date,
): string | null {
  if (!startsAt) return null;
  const at = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(at.getTime())) return null;
  const ms = at.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0)
    return hours > 0
      ? `${days} ${days === 1 ? "day" : "days"} ${hours}h`
      : `${days} ${days === 1 ? "day" : "days"}`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

export type RoomCardAction = "START" | "JOIN" | "SIGN_IN" | "COUNTDOWN";

/**
 * The one action a room card offers. Hosts start a scheduled room once it is ready (from 15 minutes before its time).
 * Signed in people join a live room. Signed out visitors are asked to sign in for a live room and see a countdown for an
 * upcoming one. Nobody is shown a Join button that would not work.
 */
export function roomCardAction(input: {
  status: "LIVE" | "SCHEDULED";
  scheduledFor: string | null;
  signedIn: boolean;
  isHost: boolean;
  /** False when the room is full or locked for this viewer. */
  canJoin?: boolean;
  now: Date;
  readyLeadMin?: number;
}): RoomCardAction {
  const lead = (input.readyLeadMin ?? 15) * 60_000;
  if (input.status === "LIVE") {
    if (!input.signedIn) return "SIGN_IN";
    return input.canJoin === false && !input.isHost ? "COUNTDOWN" : "JOIN";
  }
  if (input.signedIn && input.isHost) {
    const at = input.scheduledFor ? new Date(input.scheduledFor).getTime() : NaN;
    const ready = Number.isNaN(at) || at - input.now.getTime() <= lead;
    return ready ? "START" : "COUNTDOWN";
  }
  return "COUNTDOWN";
}

export interface RelatedCandidate {
  slug: string;
  status: "LIVE" | "SCHEDULED" | "ENDED";
  visibility: "PUBLIC" | "PRIVATE";
  topicSlug: string | null;
  language: Language;
  scheduledFor: string | null;
  listeners: number;
  /** True when the viewer may see this room (public, or private and they are in it). */
  accessible: boolean;
}

export interface RelatedTarget {
  slug: string;
  topicSlug: string | null;
  language: Language;
  scheduledFor: string | null;
}

/**
 * Related rooms: the same topic first, then the same language, then live before upcoming, then the closest start time
 * (and the busiest live room). A room never recommends itself, an ended room, a room the viewer cannot see, or a
 * duplicate. The list is capped.
 */
export function rankRelated<T extends RelatedCandidate>(
  target: RelatedTarget,
  candidates: readonly T[],
  now: Date,
  limit = 6,
): T[] {
  const seen = new Set<string>([target.slug]);
  const targetAt = target.scheduledFor ? new Date(target.scheduledFor).getTime() : now.getTime();
  const eligible = candidates.filter((c) => {
    if (seen.has(c.slug)) return false;
    if (c.status === "ENDED" || !c.accessible) return false;
    seen.add(c.slug);
    return true;
  });
  const score = (c: T): [number, number, number, number, number] => {
    const at = c.scheduledFor ? new Date(c.scheduledFor).getTime() : now.getTime();
    return [
      target.topicSlug !== null && c.topicSlug === target.topicSlug ? 0 : 1,
      c.language === target.language ? 0 : 1,
      c.status === "LIVE" ? 0 : 1,
      Math.abs(at - targetAt),
      -c.listeners,
    ];
  };
  return eligible
    .sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      for (let i = 0; i < sa.length; i++) {
        const d = (sa[i] ?? 0) - (sb[i] ?? 0);
        if (d !== 0) return d;
      }
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, limit);
}

/** Filters every room list accepts. Anything unusable is dropped, so a bad link shows the unfiltered list. */
export const publicRoomsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || undefined),
  topic: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || undefined),
  language: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((v) => v?.toUpperCase())
    .pipe(z.enum(LANGUAGES).optional().catch(undefined)),
});
export type PublicRoomsQuery = z.infer<typeof publicRoomsQuerySchema>;
