import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";
import { discover } from "@/server/interests/service";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const { user } = await requireOnboarded();
  await enforce(policies.peopleSearch, user.id);
  return json(await discover(user.id));
});
