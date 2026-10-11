import { peopleSearchSchema } from "@gistroom/shared";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";
import { searchEverything } from "@/server/search/service";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  await enforce(policies.peopleSearch, user.id);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  // The same length rules as people search, so a one letter query never hits the database.
  const { q: checked } = peopleSearchSchema.pick({ q: true }).parse({ q: q.replace(/^@+/, "") });
  return json(await searchEverything(user, checked));
});
