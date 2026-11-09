/**
 * Zod 3's `required_error`, kept for Zod 4: the message applies only when the value is missing, and any other wrong
 * type falls through to Zod's own message. Use it as `z.string({ error: requiredMessage("Say something.") })`.
 */
export const requiredMessage =
  (message: string) =>
  (issue: { input?: unknown }): string | undefined =>
    issue.input === undefined ? message : undefined;
