/**
 * A finished account has a password, a Google link, or a completed profile. Signing up with the email of a finished
 * account must not take it over, so it gets an "you already have an account" email instead of a code.
 */
export function isCompleteAccount(input: {
  passwordHash: string | null;
  onboardedAt: Date | null;
  googleLinked: boolean;
}): boolean {
  return input.passwordHash !== null || input.onboardedAt !== null || input.googleLinked;
}

/** A device is new when the person has signed in before but never from one with this label. */
export function isNewDevice(previousLabels: readonly (string | null)[], label: string): boolean {
  if (previousLabels.length === 0) return false;
  return !previousLabels.includes(label);
}

/** Onboarding needs a password unless the person arrived through Google. */
export function passwordRequiredAtOnboarding(input: {
  googleLinked: boolean;
  hasPassword: boolean;
}): boolean {
  return !input.googleLinked && !input.hasPassword;
}

export type AccountState = "NONE" | "UNFINISHED" | "PASSWORD" | "GOOGLE_ONLY";

/** What sign in should do with an email: nothing there, a half finished sign up, a password account, or Google only. */
export function accountState(
  user: { passwordHash: string | null; onboardedAt: Date | null; googleLinked: boolean } | null,
): AccountState {
  if (!user) return "NONE";
  if (user.passwordHash !== null) return "PASSWORD";
  if (user.googleLinked) return "GOOGLE_ONLY";
  return "UNFINISHED";
}

/** After the email is confirmed: a password comes first, then the profile. */
export function nextAuthStep(user: {
  passwordHash: string | null;
  onboardedAt: Date | null;
  googleLinked: boolean;
}): "password" | "onboarding" | "done" {
  if (user.onboardedAt) return "done";
  return passwordRequiredAtOnboarding({
    googleLinked: user.googleLinked,
    hasPassword: user.passwordHash !== null,
  })
    ? "password"
    : "onboarding";
}
