import { z } from "zod";
import { LIMITS } from "./limits";

export const noteBodySchema = z
  .string({ required_error: "Write something first." })
  .trim()
  .min(1, "Write something first.")
  .max(LIMITS.NOTE_MAX_CHARS, `Notes can be up to ${LIMITS.NOTE_MAX_CHARS} characters.`);

/** A note belongs to one chat or one room, never both. */
export const createNoteSchema = z
  .object({
    conversationId: z.string().trim().min(1).max(64).optional(),
    roomSlug: z.string().trim().min(1).max(64).optional(),
    body: noteBodySchema,
  })
  .refine((v) => Boolean(v.conversationId) !== Boolean(v.roomSlug), {
    message: "Choose a chat or a room for the note.",
  });
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({ body: noteBodySchema });

export interface NoteDto {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
