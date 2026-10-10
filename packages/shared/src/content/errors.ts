/**
 * Messages the API sends (R10, R9). They say what happened and what to do next, with no apology.
 * Security and account messages use plain English, no slang.
 */
export const errors = {
  unauthorized: "Sign in to continue.",
  forbidden: "You cannot do that here.",
  notFound: "We could not find that.",
  invalidRequest: "Check the details and try again.",
  originMismatch: "That request did not come from Gistroom. Refresh the page and try again.",
  rateLimited: (seconds: number) => `Easy, easy. Try again in ${seconds} seconds.`,
  server: "Gistroom hit a problem on our side. Try again in a moment.",
  mailFailed: "We could not send your code. Wait a moment and try again.",
  otpCooldown: (seconds: number) => `Wait ${seconds} seconds before you ask for another code.`,
  otpHourly: (minutes: number) =>
    `You have asked for too many codes. Try again in ${minutes} minutes.`,
  otpWrong: (left: number) =>
    `That code is not right. You have ${left} ${left === 1 ? "try" : "tries"} left.`,
  otpLocked: (minutes: number) => `Too many wrong codes. Try again in ${minutes} minutes.`,
  otpExpired: "That code has expired. Ask for a new one.",
  otpUsed: "That code was already used. Ask for a new one.",
  loginFailed: "That email and password do not match. Check them and try again.",
  passwordRequired: "Choose a password to finish setting up.",
  currentPasswordWrong: "That is not your current password.",
  currentPasswordNeeded: "Enter your current password.",
  passwordChanged: "Your password is updated.",
  otpMissing: "Ask for a code first, then enter it here.",
  accountSuspended: "This account is suspended. Write to support@gistroom.ng to find out why.",
  accountDeleted: "This account was deleted. You can sign up again with the same email.",
  usernameTaken: "That username is taken. Try another one.",
  alreadyOnboarded: "Your profile is already set up.",
  notOnboarded: "Finish setting up your profile to continue.",
  googleUnavailable: "Google sign in is not available right now. Use your email instead.",
  googleFailed: "Google sign in did not finish. Try again or use your email.",
  googleEmailUnverified: "Google did not confirm that email address. Use your email instead.",
  friendUnavailable: "You can't send a request to this person right now.",
  friendLimitHour: "You have sent a lot of requests this hour. Try again later.",
  friendLimitDay: "You have reached the daily limit for friend requests. Try again tomorrow.",
  notFriends: "You can only do that with friends.",
  blocked: "You cannot do that with this person.",
  messageTooLong: (max: number) => `Messages can be up to ${max} characters.`,
  deleteWindowClosed: "You can only delete a message for everyone in the first hour.",
} as const;

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "ORIGIN"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "MAIL_FAILED"
  | "SERVER";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field level messages keyed by field name, for inline form errors (R4). */
    fields?: Record<string, string>;
    retryAfterSec?: number;
  };
}
