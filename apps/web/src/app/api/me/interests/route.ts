import { interestsSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { getInterests, setInterests } from "@/server/interests/service";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const { user } = await requireUser();
  return json({ topics: await getInterests(user.id) });
});

export const PUT = api(async (request) => {
  const { user } = await requireUser();
  const { topics } = await parseJson(request, interestsSchema);
  return json({ topics: await setInterests(user.id, topics) });
});
