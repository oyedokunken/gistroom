import { z } from "zod";
import { LIMITS } from "./limits";
import { validation } from "./content/validation";
import { RESERVED_USERNAMES } from "./reserved-usernames";
import { loginPasswordSchema, newPasswordSchema } from "./password";

export const emailSchema = z
  .string({ required_error: validation.emailRequired })
  .trim()
  .toLowerCase()
  .min(1, validation.emailRequired)
  .max(254, validation.emailTooLong)
  .email(validation.emailInvalid);

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

export const loginSchema = z.object({ email: emailSchema, password: loginPasswordSchema });
export type LoginInput = z.infer<typeof loginSchema>;

export const identifySchema = z.object({ email: emailSchema });
export const setPasswordSchema = z.object({ password: newPasswordSchema });

export const resetStartSchema = z.object({ email: emailSchema });
export const resetCompleteSchema = z.object({
  email: emailSchema,
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
