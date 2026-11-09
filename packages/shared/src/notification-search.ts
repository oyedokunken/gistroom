import { z } from "zod";
import { LIMITS } from "./limits";
import type { NotificationType } from "./dto";
import { notificationSearchAliases } from "./content/notification-search";

/**
 * Search inside a person's own notification list. Everything here is pure so the route, the page and the tests agree.
 * The route always adds `userId` to the query, so nothing outside the signed in person's rows can match.
 */

/** Payload keys that search may read. Anything else in a payload (ids, slugs, counts, links) is never matched. */
export const SEARCHABLE_PAYLOAD_KEYS = [
  "fromName",
  "fromUsername",
  "name",
  "roomTitle",
  "preview",
  "title",
  "body",
  "text",
  "device",
] as const;

/** Trim, collapse runs of white space and cap the length. Returns "" when there is nothing to search for. */
export function normalizeSearch(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.NOTIFICATION_SEARCH_MAX_CHARS)
    .trim();
}

/** A usable search is at least two characters after normalizing. Shorter text means "no search" in the page. */
export function isSearchable(input: string | null | undefined): boolean {
  return normalizeSearch(input).length >= LIMITS.SEARCH_MIN_CHARS;
}

/** The types whose human label (or alias such as "missed call") contains the text. */
export function typesMatchingSearch(input: string): NotificationType[] {
  const needle = normalizeSearch(input).toLowerCase();
  if (needle.length < LIMITS.SEARCH_MIN_CHARS) return [];
  const out: NotificationType[] = [];
  for (const [type, aliases] of Object.entries(notificationSearchAliases) as [
    NotificationType,
    readonly string[],
  ][]) {
    if (aliases.some((a) => a.includes(needle))) out.push(type);
  }
  return out;
}

export const notificationListQuerySchema = z
  .object({
    tab: z.enum(["all", "activity"]).default("all"),
    unread: z.enum(["1", "0"]).optional(),
    q: z.string().max(400).optional(),
    cursor: z.string().max(400).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(LIMITS.PAGE_SIZE_DEFAULT),
  })
  .transform((v, ctx) => {
    const q = normalizeSearch(v.q);
    if (q.length === 1) {
      ctx.addIssue({
        code: "custom",
        path: ["q"],
        message: "Type at least 2 characters to search.",
      });
      return z.NEVER;
    }
    return {
      tab: v.tab,
      unreadOnly: v.unread === "1",
      q: q.length >= LIMITS.SEARCH_MIN_CHARS ? q : null,
      cursor: v.cursor ?? null,
      limit: v.limit,
    };
  });
export type NotificationListQuery = z.output<typeof notificationListQuerySchema>;
