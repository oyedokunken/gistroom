import { z } from "zod";
import { passwordMessages } from "./content/validation";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** A short list of passwords that people really pick. Anything on it is refused. */
const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "11111111",
  "00000000",
  "abcd1234",
  "letmein1",
  "welcome1",
  "welcome123",
  "admin123",
  "gistroom",
  "gistroom1",
  "gistroom123",
  "naija123",
  "nigeria1",
  "nigeria123",
  "lagos123",
  "football",
  "chelsea1",
  "arsenal1",
]);

export type PasswordIssue =
  "TOO_SHORT" | "TOO_LONG" | "COMMON" | "SAME_AS_EMAIL" | "ONE_CHARACTER" | "SAME_AS_NAME";

/** Rules a new password must meet. Pure, so the form and the server agree. */
export function passwordIssue(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordIssue | null {
  if (password.length < PASSWORD_MIN) return "TOO_SHORT";
  if (password.length > PASSWORD_MAX) return "TOO_LONG";
  if (new Set(password).size === 1) return "ONE_CHARACTER";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "COMMON";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (
    context.email &&
    (lower === context.email.toLowerCase() || (local && local.length >= 4 && lower === local))
  ) {
    return "SAME_AS_EMAIL";
  }
  if (
    context.name &&
    context.name.trim().length >= 4 &&
    lower === context.name.trim().toLowerCase()
  )
    return "SAME_AS_NAME";
  return null;
}

/** Zod field for a new password. Pass the context for the checks that need it. */
export const newPasswordSchema = z
  .string({ required_error: passwordMessages.required })
  .superRefine((value, ctx) => {
    const issue = passwordIssue(value);
    if (issue) ctx.addIssue({ code: "custom", message: passwordMessages[issue] });
  });

/** Login only needs a non empty value. Strength is judged when a password is set, not when it is used. */
export const loginPasswordSchema = z
  .string({ required_error: passwordMessages.loginRequired })
  .min(1, passwordMessages.loginRequired)
  .max(PASSWORD_MAX, passwordMessages.TOO_LONG);
