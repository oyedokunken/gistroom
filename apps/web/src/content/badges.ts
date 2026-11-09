/** Copy for badges and the expanded profile (R10). The badge names and rules live in packages/shared/src/badges.ts. */
export const badgeCopy = {
  heading: "Badges",
  lead: "Earned by taking part. Each badge says how it is earned.",
  none: "No badges yet. Host or join rooms, make friends and come back often to earn them.",
  noneOther: "No badges to show yet.",
  count: (n: number) => `x${n}`,
  earned: (n: number) => (n === 1 ? "Earned once" : `Earned ${n} times`),
  private: "Only you see this badge.",
  hiddenByOwner: "This person keeps their badges private.",
  moreLabel: (n: number) => `${n} more badges`,
  listLabel: "Badges",
  showNextToName: "Show badges next to my name",
  showNextToNameHelp:
    "Turn this off and your badges are hidden from chats, rooms and search. You keep everything you earned, and you still see it here.",
} as const;

export const profileExtras = {
  verified: "Email verified",
  unverified: "Email not verified",
  joined: (when: string) => `Joined ${when}`,
  friends: (n: number) => (n === 1 ? "1 friend" : `${n} friends`),
  interestsHeading: "Interests",
  interestsNone: "No interests picked yet.",
  statsLabel: "About this person",
} as const;

export const emailVerify = {
  heading: "Email address",
  verifiedTitle: "Your email is verified",
  verifiedBody: "Only you can see your email. It stays as it is.",
  unverifiedTitle: "Your email is not verified",
  unverifiedBody: "Verify it so you can recover your account and get important notices.",
  send: "Send a code",
  sending: "Sending",
  sentTo: (email: string) => `We sent a 6 digit code to ${email}.`,
  codeLabel: "6 digit code",
  confirm: "Verify email",
  confirming: "Checking",
  resend: "Send a new code",
  resendIn: (seconds: number) => `You can ask for a new code in ${seconds} seconds.`,
  done: "Your email is verified.",
  failed: "We could not verify that code. Check it and try again.",
  immutableTitle: "Email and username are permanent",
  immutableBody:
    "Your email and username cannot be changed after you sign up. They are how you sign in, recover your account and how friends find you.",
} as const;
