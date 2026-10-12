import { discoverQuerySchema } from "@gistroom/shared";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";
import { discoverFeed } from "@/server/discover/service";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  await enforce(policies.peopleSearch, user.id);
  const params = new URL(request.url).searchParams;
  const query = discoverQuerySchema.parse({
    topic: params.get("topic") ?? undefined,
    language: params.get("language") ?? undefined,
    q: params.get("q") ?? undefined,
    sort: params.get("sort") ?? undefined,
  });
  return json(await discoverFeed(user, query));
});
