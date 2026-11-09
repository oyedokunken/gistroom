import { getDb, type User } from "@gistroom/db";
import { AppError } from "../http";
import { enforce, policies } from "../rate-limit";
import { checkCode, sendCode } from "../auth/otp-service";

/**
 * Confirms the address on an account that has not confirmed it (an account made before codes were required, for
 * example). It uses the same one time code rules as sign up: 6 digits, 10 minutes, a 60 second wait before a new one,
 * 5 a day per address and 5 tries before a lock. The address itself can never change, so the code always goes to the
 * address the account already has.
 */
export async function startEmailVerification(
  user: User,
  ip: string,
): Promise<{ resendAfterSec: number }> {
  await enforce(policies.emailVerify, user.id);
  if (user.emailVerifiedAt) throw new AppError(409, "CONFLICT", "Your email is already verified.");
  return sendCode({
    email: user.email,
    ip,
    purpose: "VERIFY_EMAIL",
    template: "verify-otp",
  });
}

export async function confirmEmailVerification(
  user: User,
  input: { code: string },
  ip: string,
): Promise<{ verifiedAt: Date }> {
  await enforce(policies.emailVerify, user.id);
  if (user.emailVerifiedAt) return { verifiedAt: user.emailVerifiedAt };
  await checkCode({ email: user.email, code: input.code, ip, purpose: "VERIFY_EMAIL" });
  const verifiedAt = new Date();
  await getDb().user.update({ where: { id: user.id }, data: { emailVerifiedAt: verifiedAt } });
  return { verifiedAt };
}
