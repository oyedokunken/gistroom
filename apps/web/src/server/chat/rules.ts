import { LIMITS } from "@gistroom/shared";

/** Delete for everyone: the sender only, inside the window, once (Section 9.3, D4). */
export function canDeleteForEveryone(input: {
  senderId: string;
  userId: string;
  createdAt: Date;
  alreadyDeleted: boolean;
  now: Date;
}): { ok: true } | { ok: false; reason: "NOT_SENDER" | "WINDOW_CLOSED" | "ALREADY_DELETED" } {
  if (input.senderId !== input.userId) return { ok: false, reason: "NOT_SENDER" };
  if (input.alreadyDeleted) return { ok: false, reason: "ALREADY_DELETED" };
  const ageMin = (input.now.getTime() - input.createdAt.getTime()) / 60_000;
  if (ageMin > LIMITS.DELETE_FOR_EVERYONE_WINDOW_MIN) return { ok: false, reason: "WINDOW_CLOSED" };
  return { ok: true };
}

/** Edit: the sender only, text messages only, inside the first 15 minutes, never once deleted. */
export function canEditMessage(input: {
  senderId: string;
  userId: string;
  type: string;
  createdAt: Date;
  deleted: boolean;
  now: Date;
}): { ok: true } | { ok: false; reason: "NOT_ALLOWED" | "WINDOW_CLOSED" } {
  if (input.senderId !== input.userId || input.type !== "TEXT" || input.deleted)
    return { ok: false, reason: "NOT_ALLOWED" };
  const ageMin = (input.now.getTime() - input.createdAt.getTime()) / 60_000;
  if (ageMin > LIMITS.EDIT_WINDOW_MIN) return { ok: false, reason: "WINDOW_CLOSED" };
  return { ok: true };
}

/** What the viewer may see of a chat: blocked people see it as unavailable and are never told why. */
export function chatAvailability(input: {
  blockedByMe: boolean;
  blockedMe: boolean;
  peerGone: boolean;
}): "OK" | "BLOCKED_BY_ME" | "UNAVAILABLE" {
  if (input.blockedByMe) return "BLOCKED_BY_ME";
  if (input.blockedMe || input.peerGone) return "UNAVAILABLE";
  return "OK";
}

/** A conversation shows in the list unless it was cleared and nothing newer has arrived (Section 9.3). */
export function showInList(input: { clearedAt: Date | null; lastMessageAt: Date | null }): boolean {
  if (!input.clearedAt) return true;
  return input.lastMessageAt !== null && input.lastMessageAt > input.clearedAt;
}

/**
 * Archived chats stay archived when a message arrives (D3), but the Archived row shows a dot
 * when something new came in since the person last looked.
 */
export function archivedHasActivity(unreadInArchived: readonly number[]): boolean {
  return unreadInArchived.some((n) => n > 0);
}

export { previewText } from "@gistroom/shared";

/** One emoji per reaction, as a single grapheme from the picker (Section 9.3). */
export function isSingleEmoji(value: string): boolean {
  if (value.length === 0 || value.length > 32) return false;
  const segments = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)];
  return segments.length === 1 && /\p{Extended_Pictographic}/u.test(value);
}

export const MESSAGE_TYPES_WITH_BODY = new Set(["TEXT"]);

/** Text messages need a body. Media messages may carry an optional caption. */
export function bodyIsValid(type: string, body: string | null | undefined): boolean {
  const text = (body ?? "").trim();
  if (text.length > LIMITS.MESSAGE_MAX_CHARS) return false;
  if (MESSAGE_TYPES_WITH_BODY.has(type)) return text.length > 0;
  return true;
}
