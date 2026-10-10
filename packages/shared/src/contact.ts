import { z } from "zod";
import { emailSchema, nameSchema } from "./auth";
import { validation } from "./content/validation";

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 2000;

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  message: z
    .string({ required_error: validation.contactMessageShort })
    .trim()
    .min(CONTACT_MESSAGE_MIN, validation.contactMessageShort)
    .max(CONTACT_MESSAGE_MAX, validation.contactMessageLong(CONTACT_MESSAGE_MAX)),
  /** A hidden field real people never fill in. Bots do. */
  website: z.string().max(200).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;
