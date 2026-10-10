import { redirect } from "next/navigation";
import { getSessionContext, type SessionContext } from "./session";

/** For server pages inside the app. The layout already guards, this narrows the type and keeps pages safe alone. */
export async function requireUserForPage(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login?error=session_expired");
  if (!ctx.user.onboardedAt) redirect("/onboarding");
  return ctx;
}
