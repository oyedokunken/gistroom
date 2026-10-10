import { getDb } from "@gistroom/db";
import { usernameCheckSchema } from "@gistroom/shared";
import { api, clientIp, json } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";

/** Live availability check for onboarding, with its own rate limit (Section 6.4). */
export const GET = api(async (request) => {
  const { user } = await requireUser();
  await enforce(policies.usernameCheck, `${user.id}:${await clientIp()}`);
  const url = new URL(request.url);
  const parsed = usernameCheckSchema.safeParse({
    username: url.searchParams.get("username") ?? "",
  });
  if (!parsed.success) {
    return json({ available: false, reason: parsed.error.issues[0]?.message ?? null });
  }
  const taken = await getDb().user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });
  return json({ available: !taken || taken.id === user.id, reason: null });
});
