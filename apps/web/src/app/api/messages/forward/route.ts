import { forwardSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { forwardMessages } from "@/server/chat/forward";

/** Forward chosen messages to chosen friends. Retries with the same batch id never create a second copy. */
export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, forwardSchema);
  return json(await forwardMessages(user, input));
});
