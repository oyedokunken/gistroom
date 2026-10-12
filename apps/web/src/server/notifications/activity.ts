import { getDb } from "@gistroom/db";

/** A week. Activity entries are a receipt for what you did, not something to keep. */
export const ACTIVITY_TTL_MS = 7 * 86_400_000;
export const ACTIVITY_TYPE = "ACTIVITY";

export type ActivityUndo =
  { action: "unarchive"; conversationId: string } | { action: "unblock"; userId: string };

export interface ActivityInput {
  userId: string;
  /** A short machine word, for example "archived" or "blocked". */
  kind: string;
  /** What the person did, in plain words: "You archived your chat with Ada." */
  text: string;
  /** Where to look at the result. Always inside the app. */
  href?: string;
  undo?: ActivityUndo;
}

/**
 * Writes one line to the Activity list. It is already marked read, so it never counts as unread, never reaches push or
 * email, and expires after a week. A failure here must never undo or block the thing the person actually did.
 */
export async function recordActivity(input: ActivityInput, now = new Date()): Promise<void> {
  try {
    await getDb().notification.create({
      data: {
        userId: input.userId,
        type: ACTIVITY_TYPE,
        readAt: now,
        expiresAt: new Date(now.getTime() + ACTIVITY_TTL_MS),
        payload: {
          kind: input.kind,
          text: input.text,
          ...(input.href ? { href: input.href } : {}),
          ...(input.undo ? { undo: input.undo } : {}),
        },
      },
    });
  } catch {
    // Activity is a convenience. The action already happened.
  }
}
