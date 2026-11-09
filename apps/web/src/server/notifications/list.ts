import type { Prisma } from "@gistroom/db";
import {
  SEARCHABLE_PAYLOAD_KEYS,
  typesMatchingSearch,
  type NotificationListQuery,
} from "@gistroom/shared";

export interface ListCursor {
  t: string;
  id: string;
}

export const isListCursor = (v: unknown): v is ListCursor =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as ListCursor).t === "string" &&
  typeof (v as ListCursor).id === "string" &&
  !Number.isNaN(new Date((v as ListCursor).t).getTime());

/**
 * The where clause for one page of a person's notifications. `userId` is always the first condition and the search text
 * is only ever matched inside rows that already belong to that person (R16, R17). The text is passed as a parameter by
 * Prisma, never built into SQL. Search reads a short list of payload keys and the type labels, nothing else.
 */
export function notificationWhere(
  userId: string,
  query: NotificationListQuery,
  cursor: ListCursor | null,
  now: Date,
): Prisma.NotificationWhereInput {
  const and: Prisma.NotificationWhereInput[] = [];
  // Activity is the person's own receipts. It never mixes into All or Unread.
  and.push(
    query.tab === "activity"
      ? { type: "ACTIVITY", expiresAt: { gt: now } }
      : { type: { not: "ACTIVITY" } },
  );
  if (query.unreadOnly) and.push({ readAt: null });
  if (query.q) {
    const text = query.q;
    const keys = query.tab === "activity" ? (["text"] as const) : SEARCHABLE_PAYLOAD_KEYS;
    const byType = query.tab === "activity" ? [] : typesMatchingSearch(text);
    and.push({
      OR: [
        ...keys.map((key): Prisma.NotificationWhereInput => ({
          payload: { path: [key], string_contains: text, mode: "insensitive" },
        })),
        ...(byType.length ? [{ type: { in: byType } }] : []),
      ],
    });
  }
  if (cursor) {
    const at = new Date(cursor.t);
    and.push({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }] });
  }
  return { userId, AND: and };
}
