import { getDb, type User } from "@gistroom/db";
import { LIMITS, errors } from "@gistroom/shared";
import { AppError } from "../http";
import { findOrCreateUser } from "./otp-service";
import { resolveGoogleAction, type GoogleIdentity } from "./google";

function assertActive(user: User): void {
  if (user.status === "SUSPENDED") throw new AppError(403, "FORBIDDEN", errors.accountSuspended);
  if (user.status === "DELETED") throw new AppError(403, "FORBIDDEN", errors.accountDeleted);
}

/** Sign in, link or create from a verified Google identity. Returns the person to start a session for. */
export async function signInWithGoogle(
  identity: GoogleIdentity,
): Promise<{ user: User; isNew: boolean }> {
  const db = getDb();
  const now = new Date();
  const account = await db.authAccount.findUnique({
    where: { provider_providerAccountId: { provider: "GOOGLE", providerAccountId: identity.sub } },
    include: { user: true },
  });
  const emailUser = account ? null : await db.user.findUnique({ where: { email: identity.email } });

  const action = resolveGoogleAction({
    emailVerified: identity.emailVerified,
    accountExists: account !== null,
    emailUserExists: emailUser !== null,
  });

  switch (action) {
    case "REFUSE_UNVERIFIED":
      throw new AppError(400, "INVALID", errors.googleEmailUnverified);
    case "SIGN_IN": {
      const user = account!.user;
      assertActive(user);
      return { user, isNew: false };
    }
    case "LINK": {
      const user = emailUser!;
      assertActive(user);
      await db.authAccount.create({
        data: { userId: user.id, provider: "GOOGLE", providerAccountId: identity.sub },
      });
      const verified = user.emailVerifiedAt
        ? user
        : await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
      return { user: verified, isNew: false };
    }
    case "CREATE": {
      const { user } = await findOrCreateUser(identity.email, now);
      const named = user.name
        ? user
        : await db.user.update({
            where: { id: user.id },
            data: { name: identity.name.trim().slice(0, LIMITS.NAME_MAX) },
          });
      await db.authAccount.create({
        data: { userId: named.id, provider: "GOOGLE", providerAccountId: identity.sub },
      });
      return { user: named, isNew: true };
    }
  }
}
