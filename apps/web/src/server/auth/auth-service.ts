import { getDb, type User } from "@gistroom/db";
import { errors, identifierKind, passwordIssue, passwordMessages } from "@gistroom/shared";
import { AppError } from "../http";
import { enforce, policies } from "../rate-limit";
import { sendTemplate } from "../mail/send";
import { notify } from "../notifications/service";
import { checkCode, findOrCreateUser, sendCode, type RequestOtpResult } from "./otp-service";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "./password";
import { accountState, isCompleteAccount, type AccountState } from "./rules";
import { cookies } from "next/headers";
import { DEVICE_COOKIE } from "./tokens";
import {
  hasRecentAuth,
  markAuthenticated,
  revokeAllSessions,
  revokeOtherSessions,
} from "./session";

const FIELD = "password";

/** Finds a person by email or by username. An email always has an @, a username never does. */
async function findByIdentifier(identifier: string) {
  const db = getDb();
  return identifier.includes("@")
    ? db.user.findUnique({ where: { email: identifier } })
    : db.user.findUnique({ where: { username: identifier } });
}

/** Start sign up. An email that already has a finished account is told so plainly. A half finished sign up gets a fresh code. */
export async function startSignup(email: string, ip: string): Promise<RequestOtpResult> {
  const db = getDb();
  const user = await db.user.findUnique({
    where: { email },
    select: {
      status: true,
      passwordHash: true,
      onboardedAt: true,
      _count: { select: { authAccounts: true } },
    },
  });
  const finished =
    user !== null &&
    (user.status !== "ACTIVE" ||
      isCompleteAccount({
        passwordHash: user.passwordHash,
        onboardedAt: user.onboardedAt,
        googleLinked: user._count.authAccounts > 0,
      }));

  if (finished) {
    await enforce(policies.otpSendIp, ip);
    throw new AppError(409, "CONFLICT", errors.emailTaken, {
      fields: { email: errors.emailTaken },
    });
  }
  return sendCode({ email, ip, purpose: "SIGN_UP", template: "verify-otp" });
}

/** Confirm the code. The account exists from here on but has no password and no profile until onboarding. */
export async function completeSignup(
  email: string,
  code: string,
  ip: string,
): Promise<{ user: User; isNew: boolean }> {
  await checkCode({ email, code, ip, purpose: "SIGN_UP" });
  return findOrCreateUser(email, new Date());
}

/**
 * Email and password sign in. A wrong email and a wrong password look the same and take about the same time,
 * so nobody can use this to find out who has an account (Section 6.4).
 */
export async function login(email: string, password: string, ip: string): Promise<User> {
  await enforce(policies.loginIp, ip);
  await enforce(policies.loginEmail, email);

  const user = await findByIdentifier(email);
  const stored = user?.passwordHash ?? (await dummyHash());
  const ok = await verifyPassword(password, stored);
  if (!user || !user.passwordHash || !ok || user.status === "DELETED") {
    throw new AppError(
      401,
      "UNAUTHORIZED",
      identifierKind(email) === "email" ? errors.loginFailedEmail : errors.loginFailedUsername,
    );
  }
  if (user.status === "SUSPENDED") throw new AppError(403, "FORBIDDEN", errors.accountSuspended);

  if (needsRehash(user.passwordHash)) {
    await getDb().user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });
  }
  return user;
}

/**
 * Start a password reset for an email or a username. The answer is always the same, so nobody can use this to find out
 * who has an account. A match gets the code at its own email address.
 */
export async function startReset(identifier: string, ip: string): Promise<RequestOtpResult> {
  await enforce(policies.otpSendIp, ip);
  const user = await findByIdentifier(identifier);
  if (!user || user.status !== "ACTIVE") return { resendAfterSec: 60 };
  return sendCode({ email: user.email, ip, purpose: "RESET_PASSWORD", template: "reset-otp" });
}

/** What sign in should do next for this email. Rate limited like a sign in attempt. */
export async function identifyAccount(identifier: string, ip: string): Promise<AccountState> {
  await enforce(policies.loginIp, ip);
  await enforce(policies.loginEmail, identifier);
  const found = await findByIdentifier(identifier);
  if (found?.status === "SUSPENDED") throw new AppError(403, "FORBIDDEN", errors.accountSuspended);
  // The forms say plainly when there is no account (D38), so nobody types a password into nothing.
  if (!found || found.status === "DELETED") return "NONE";
  const googleLinked = (await getDb().authAccount.count({ where: { userId: found.id } })) > 0;
  const state = accountState({
    passwordHash: found.passwordHash,
    onboardedAt: found.onboardedAt,
    googleLinked,
  });
  // A half finished sign up has no real username yet, so it can only be continued with the email.
  return state === "UNFINISHED" && !identifier.includes("@") ? "PASSWORD" : state;
}

export async function completeReset(
  identifier: string,
  code: string,
  password: string,
  ip: string,
): Promise<User> {
  const user = await findByIdentifier(identifier);
  // A made up identifier is checked against a made up address, so the answer looks like any other wrong code.
  const email = user?.email ?? identifier;
  const issue = passwordIssue(password, { email, name: user?.name });
  if (issue)
    throw new AppError(400, "INVALID", passwordMessages[issue], {
      fields: { [FIELD]: passwordMessages[issue] },
    });

  await checkCode({ email, code, ip, purpose: "RESET_PASSWORD" });
  if (!user || user.status !== "ACTIVE") {
    throw new AppError(400, "INVALID", errors.otpMissing, { fields: { code: errors.otpMissing } });
  }
  const updated = await getDb().user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordUpdatedAt: new Date(),
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
  // Everyone signed in with the old password is signed out. The device that is resetting keeps its alerts.
  let deviceId: string | null = null;
  try {
    deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
  } catch {
    // Called outside a request (a script or a test): no device to keep.
  }
  await revokeAllSessions(user.id, deviceId);
  await announcePasswordChanged(updated);
  return updated;
}

/** Set the first password (onboarding, or a Google account adding one) without a current password. */
export async function setInitialPassword(user: User, password: string): Promise<void> {
  const issue = passwordIssue(password, { email: user.email, name: user.name });
  if (issue)
    throw new AppError(400, "INVALID", passwordMessages[issue], {
      fields: { [FIELD]: passwordMessages[issue] },
    });
  await getDb().user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), passwordUpdatedAt: new Date() },
  });
}

/** The email that says a password changed, with the time in the person's own time zone. Never blocks the change. */
async function announcePasswordChanged(user: User): Promise<void> {
  const when = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: user.timezone,
  }).format(new Date());
  await sendTemplate("password-changed", user.email, { when }).catch(() => undefined);
}

/** Change a password. People who already have one must give the current one. Other devices are signed out. */
export async function changePassword(
  user: User,
  sessionId: string,
  input: { currentPassword?: string; newPassword: string },
): Promise<void> {
  await enforce(policies.passwordChange, user.id);
  if (!user.passwordHash) {
    // Nothing to type again, so a stale sign in has to be renewed by signing in.
    const s = await getDb().session.findUnique({
      where: { id: sessionId },
      select: { authenticatedAt: true },
    });
    if (!s || !hasRecentAuth(s)) throw new AppError(403, "REAUTH", errors.reauthSignIn);
  }
  if (user.passwordHash) {
    if (!input.currentPassword) {
      throw new AppError(400, "INVALID", errors.currentPasswordNeeded, {
        fields: { currentPassword: errors.currentPasswordNeeded },
      });
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new AppError(400, "INVALID", errors.currentPasswordWrong, {
        fields: { currentPassword: errors.currentPasswordWrong },
      });
    }
  }
  await setInitialPassword(user, input.newPassword);
  await markAuthenticated(sessionId);
  await revokeOtherSessions(user.id, sessionId);
  await announcePasswordChanged(user);
}

/** After a sign in from a device we have not seen: tell the person in the app, by alert and by email (Section 10.6). */
export async function announceNewDevice(
  user: User,
  sessionId: string,
  device: string,
): Promise<void> {
  if (!user.onboardedAt) return;
  await notify({
    userId: user.id,
    type: "SECURITY_NEW_DEVICE",
    dedupeKey: `sec:${sessionId}`,
    payload: { sessionId, device },
  });
  const when = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: user.timezone,
  }).format(new Date());
  await sendTemplate("new-device-sign-in", user.email, { device, when }).catch(() => undefined);
}
