import { z } from "zod";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { enforce, policies } from "@/server/rate-limit";
import { dismissSuggestion } from "@/server/people/suggestions";

const schema = z.object({ userId: z.string().trim().min(1).max(64) });

/** "Not interested". The person is not suggested again. Repeating it changes nothing. */
export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  await enforce(policies.suggestions, user.id);
  const { userId } = await parseJson(request, schema);
  await dismissSuggestion(user.id, userId);
  return json({ ok: true });
});
