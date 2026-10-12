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
  loginFailedEmail: "Email or password is incorrect.",
  loginFailedUsername: "Username or password is incorrect.",
  resetSent: "If an account matches, we sent a code to its email.",
  emailInUse: "That email address is already used by another account.",
  emailSame: "That is already your email address.",
  emailChanged: "Your email address is updated.",
  usernameChangeLimit: "You changed your username a lot today. Try again tomorrow.",
  deleteWrongPassword: "That password is not right.",
  noAccount: "There is no Gistroom account with that email. Sign up to get started.",
  emailTaken: "That email already has an account. Sign in instead.",
  googleOnly:
    "That email signs in with Google. Use the Google button, or reset your password to add one.",
  passwordAlreadySet: "You already have a password. Change it in Settings.",
  passwordRequired: "Choose a password to finish setting up.",
  currentPasswordWrong: "That is not your current password.",
  currentPasswordNeeded: "Enter your current password.",
  passwordChanged: "Your password is updated.",
  otpMissing: "Ask for a code first, then enter it here.",
  accountSuspended: "This account is suspended. Write to support@gistroom.ng to find out why.",
  accountDeleted: "This account was deleted. You can sign up again with the same email.",
  notesFull: (max: number) => `You can keep up to ${max} notes here. Delete one to add another.`,
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
  roomNotInvited: "You are not invited to this room. Ask the host for a link.",
  roomFull: "This room is full. Try again in a minute.",
  reauthSignIn: "Sign in again to continue. It has been a while since you signed in.",
  reauthNeeded: "Confirm your password to continue. It has been a while since you signed in.",
  roomLocked: "This room is locked right now.",
  roomEnded: "This room has ended. Browse live rooms or start your own.",
  roomNotStarted: "This room has not started yet.",
  roomBanned: "You cannot join this room.",
  roomNotAllowed: "You cannot do that in this room.",
  roomNotHere: "That person is not in the room.",
  roomLinkBad: "This invite link is no longer valid. Ask the host for a new one.",
  roomChatClosed: "Chat is closed in this room right now.",
  roomSlowMode: (seconds: number) =>
    `Slow mode is on. Wait ${seconds} seconds before you send again.`,
  roomTopicMissing: "Pick one of the listed topics.",
  roomScheduleBad: "Pick a time in the future, within 30 days.",
  callsOff: "Calls are not switched on yet. Try again later.",
  callBusy: "On another call.",
  callAlready: "You are already in a call.",
  callOver: "That call is over.",
  uploadsOff: "File uploads are not switched on yet. Try again later.",
  uploadType:
    "That file type is not allowed. Send a photo, video, voice note, PDF, Word, Excel, PowerPoint, text or CSV file.",
  uploadTooBig: "That file is too big. Try a smaller one.",
  uploadEmpty: "That file is empty.",
  uploadMismatch: "That file does not look like what its name says. Check it and try again.",
  uploadNotImage: "Pick a photo for your profile picture, up to 5 MB.",
  uploadMissing: "We could not find that upload. Try sending it again.",
  chatUnavailable: "This chat is unavailable.",
  editWindowClosed: "You can only edit a message in the first 15 minutes.",
  editNotAllowed: "You can only edit your own text messages.",
  messageTooLong: (max: number) => `Messages can be up to ${max} characters.`,
  deleteWindowClosed: "You can only delete a message for everyone in the first 15 minutes.",
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
  | "REAUTH"
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
