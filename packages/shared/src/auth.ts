import { z } from "zod";
import { LIMITS } from "./limits";
import { validation } from "./content/validation";
import { RESERVED_USERNAMES } from "./reserved-usernames";
import { loginPasswordSchema, newPasswordSchema } from "./password";
import { MAX_INTERESTS, MIN_INTERESTS, TOPICS, canonicalTopicSlug } from "./topics";

export const emailSchema = z
  .string({ required_error: validation.emailRequired })
  .trim()
  .toLowerCase()
  .min(1, validation.emailRequired)
  .max(254, validation.emailTooLong)
  .email(validation.emailInvalid);

export type IdentifierKind = "email" | "username";

/** An email always has an @ and a username never does, so the two are told apart by that alone. */
export const identifierKind = (value: string): IdentifierKind =>
  value.includes("@") ? "email" : "username";

/**
 * Sign in takes an email or a username. Both are lowercase, so the check is case blind.
 * The error says which of the two was expected, based on what the person typed.
 */
export const identifierSchema = z
  .string({ required_error: validation.identifierRequired })
  .trim()
  .toLowerCase()
  .min(1, validation.identifierRequired)
  .max(254, validation.emailTooLong)
  .superRefine((value, ctx) => {
    if (identifierKind(value) === "email") {
      if (!z.string().email().safeParse(value).success) {
        ctx.addIssue({ code: "custom", message: validation.emailInvalid });
      }
    } else if (!LIMITS.USERNAME_REGEX.test(value)) {
      ctx.addIssue({ code: "custom", message: validation.usernameFormat });
    }
  });

export const otpCodeSchema = z
  .string({ required_error: validation.codeInvalid })
  .trim()
  .regex(/^[0-9]{6}$/, validation.codeInvalid); // six digits, equal to LIMITS.OTP_LENGTH (unit tested)

export const usernameSchema = z
  .string({ required_error: validation.usernameInvalid })
  .trim()
  .toLowerCase()
  .regex(LIMITS.USERNAME_REGEX, validation.usernameInvalid)
  .refine((u) => !RESERVED_USERNAMES.has(u), validation.usernameReserved);

export const nameSchema = z
  .string({ required_error: validation.nameRequired })
  .trim()
  .min(1, validation.nameRequired)
  .max(LIMITS.NAME_MAX, validation.nameTooLong(LIMITS.NAME_MAX));

export const requestOtpSchema = z.object({ email: emailSchema });
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({ email: emailSchema, code: otpCodeSchema });
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

/** The `email` field carries an email or a username. */
export const loginSchema = z.object({ email: identifierSchema, password: loginPasswordSchema });
export type LoginInput = z.infer<typeof loginSchema>;

export const identifySchema = z.object({ email: identifierSchema });
export const setPasswordSchema = z.object({ password: newPasswordSchema });

/** The `email` field carries an email or a username. */
export const resetStartSchema = z.object({ email: identifierSchema });
export const resetCompleteSchema = z.object({
  email: identifierSchema,
  code: otpCodeSchema,
  password: newPasswordSchema,
});
export type ResetCompleteInput = z.infer<typeof resetCompleteSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: newPasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Onboarding checks (Section 6.4). The checkboxes are validated by Zod, not by HTML.
 * The password is required for accounts that did not come from Google. The server enforces that.
 */
export const onboardingSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  password: newPasswordSchema.optional(),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: validation.ageRequired }) }),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: validation.termsRequired }) }),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const usernameCheckSchema = z.object({ username: usernameSchema });

export const peopleSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(LIMITS.SEARCH_MIN_CHARS, validation.searchTooShort(LIMITS.SEARCH_MIN_CHARS))
    .max(LIMITS.NAME_MAX),
  cursor: z.string().max(200).optional(),
  limit: z
    .number()
    .int()
    .refine((n) => (LIMITS.PAGE_SIZE_OPTIONS as readonly number[]).includes(n))
    .default(LIMITS.PAGE_SIZE_DEFAULT),
});
export type PeopleSearchInput = z.infer<typeof peopleSearchSchema>;

/** Interests are topic slugs from the shared list. An empty list clears them. */
export const interestsSchema = z.object({
  topics: z
    .array(
      z
        .string()
        .transform(canonicalTopicSlug)
        .refine((slug) => TOPICS.some((t) => t.slug === slug), validation.topicUnknown),
    )
    .transform((slugs) => [...new Set(slugs)])
    .pipe(
      z
        .array(z.string())
        .min(MIN_INTERESTS, validation.interestsTooFew(MIN_INTERESTS))
        .max(MAX_INTERESTS, validation.interestsTooMany(MAX_INTERESTS)),
    ),
});
export type InterestsInput = z.infer<typeof interestsSchema>;
