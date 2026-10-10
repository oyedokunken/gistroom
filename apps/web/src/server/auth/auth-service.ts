import { getDb, type User } from "@gistroom/db";
import { errors, passwordIssue, passwordMessages } from "@gistroom/shared";
import { AppError } from "../http";
import { enforce, hit, policies } from "../rate-limit";
import { sendTemplate } from "../mail/send";
import { notify } from "../notifications/service";
import { checkCode, findOrCreateUser, sendCode, type RequestOtpResult } from "./otp-service";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "./password";
import { isCompleteAccount } from "./rules";
import { revokeOtherSessions } from "./session";

const FIELD = "password";

/** Start sign up. A finished account gets a heads up email instead of a code, and the answer looks the same. */
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
    const decision = await hit(policies.accountExists, email);
    if (decision.allowed) await sendTemplate("account-exists", email, {}).catch(() => undefined);
    return { resendAfterSec: 60 };
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

  const user = await getDb().user.findUnique({ where: { email } });
  const stored = user?.passwordHash ?? (await dummyHash());
  const ok = await verifyPassword(password, stored);
  if (!user || !user.passwordHash || !ok || user.status === "DELETED") {
    throw new AppError(401, "UNAUTHORIZED", errors.loginFailed);
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

/** Start a password reset. Always answers the same, whether or not the email has an account. */
export async function startReset(email: string, ip: string): Promise<RequestOtpResult> {
  const user = await getDb().user.findUnique({ where: { email }, select: { status: true } });
  if (!user || user.status !== "ACTIVE") {
    await enforce(policies.otpSendIp, ip);
    return { resendAfterSec: 60 };
  }
  return sendCode({ email, ip, purpose: "RESET_PASSWORD", template: "reset-otp" });
}

export async function completeReset(
  email: string,
  code: string,
  password: string,
  ip: string,
): Promise<User> {
  const user = await getDb().user.findUnique({ where: { email } });
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
  // Everyone signed in with the old password is signed out.
  await getDb().session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
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

/** Change a password. People who already have one must give the current one. Other devices are signed out. */
export async function changePassword(
  user: User,
  sessionId: string,
  input: { currentPassword?: string; newPassword: string },
): Promise<void> {
  await enforce(policies.passwordChange, user.id);
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
  await revokeOtherSessions(user.id, sessionId);
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
