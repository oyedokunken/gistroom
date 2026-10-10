import { userIdSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { listRequests, sendRequest } from "@/server/friends/service";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  const direction =
    new URL(request.url).searchParams.get("direction") === "outgoing" ? "OUTGOING" : "INCOMING";
  return json({ requests: await listRequests(user, direction) });
});

export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const { userId } = await parseJson(request, userIdSchema);
  return json(await sendRequest(user, userId));
});
