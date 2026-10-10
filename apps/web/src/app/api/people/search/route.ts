import { peopleSearchSchema } from "@gistroom/shared";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";
import { searchPeople } from "@/server/people/search";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  await enforce(policies.peopleSearch, user.id);
  const params = new URL(request.url).searchParams;
  const input = peopleSearchSchema.parse({
    q: params.get("q") ?? "",
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
  });
  return json(await searchPeople(user.id, input.q, input.limit, input.cursor ?? null));
});
