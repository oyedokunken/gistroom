import { z } from "zod";
import { LIMITS } from "./limits";
import { validation } from "./content/validation";

export const clientIdSchema = z.string().trim().min(8).max(64);

/** Text messages. Media messages are created by the upload finalize step, never directly. */
export const sendTextSchema = z.object({
  clientId: clientIdSchema,
  body: z
    .string()
    .trim()
    .min(1, validation.messageRequired)
    .max(LIMITS.MESSAGE_MAX_CHARS, validation.messageTooLong(LIMITS.MESSAGE_MAX_CHARS)),
  replyToId: z.string().trim().min(1).max(64).nullish(),
});
export type SendTextInput = z.infer<typeof sendTextSchema>;

export const ackSchema = z.object({
  messageId: z.string().trim().min(1).max(64),
  kind: z.enum(["delivered", "read"]),
});

export const conversationPatchSchema = z
  .object({
    archived: z.boolean(),
    /** Minutes to mute for. 0 turns muting off. */
    muteMinutes: z
      .number()
      .int()
      .min(0)
      .max(60 * 24 * 365),
  })
  .partial();

export const reactionSchema = z.object({ emoji: z.string().min(1).max(32) });
export const editMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, validation.messageRequired)
    .max(LIMITS.MESSAGE_MAX_CHARS, validation.messageTooLong(LIMITS.MESSAGE_MAX_CHARS)),
});

export const REPORT_REASONS = ["SPAM", "HARASSMENT", "HATE", "SCAM", "UNSAFE", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
  /** Set when one message is reported. Left out when the whole chat is reported. */
  messageId: z.string().trim().min(1).max(64).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const starSchema = z.object({ on: z.boolean() });
export const openChatSchema = z.object({ userId: z.string().trim().min(1).max(64) });
