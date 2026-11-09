import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";
import { suggestFriends } from "@/server/people/suggestions";

export const dynamic = "force-dynamic";

/** A small, explainable list of people you may want to add. Never includes blocked, hidden or already connected people. */
export const GET = api(async () => {
  const { user } = await requireOnboarded();
  await enforce(policies.suggestions, user.id);
  return json({ people: await suggestFriends(user) });
});
