import { interestsSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { getInterests, setInterests } from "@/server/interests/service";
import { emailWelcome } from "@/server/mail/notify-email";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const { user } = await requireUser();
  return json({ topics: await getInterests(user.id) });
});

export const PUT = api(async (request) => {
  const { user } = await requireUser();
  const { topics } = await parseJson(request, interestsSchema);
  const first = (await getInterests(user.id)).length === 0;
  const saved = await setInterests(user.id, topics);
  // The first time someone picks their topics they have just joined, so this is when the welcome goes out.
  if (first && user.onboardedAt) void emailWelcome(user, saved);
  return json({ topics: saved });
});
