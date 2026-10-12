import { z } from "zod";
import { errors } from "@gistroom/shared";
import { AppError, api, json, parseJson } from "@/server/http";
import { verifyPassword } from "@/server/auth/password";
import { hasRecentAuth, markAuthenticated, requireUser } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/** Whether the last sign in is recent enough for a sensitive action, and whether a password can prove it. */
export const GET = api(async () => {
  const { user, session } = await requireUser();
  return json({ recent: hasRecentAuth(session), hasPassword: user.passwordHash !== null });
});

const schema = z.object({ password: z.string().min(1).max(200) });

/** Typing the password again refreshes the sign in time of this session. */
export const POST = api(async (request) => {
  const { user, session } = await requireUser();
  await enforce(policies.passwordChange, user.id);
  const { password } = await parseJson(request, schema);
  if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(400, "INVALID", errors.currentPasswordWrong, {
      fields: { password: errors.currentPasswordWrong },
    });
  }
  await markAuthenticated(session.id);
  return json({ ok: true });
});
