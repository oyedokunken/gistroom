import { LIMITS } from "@gistroom/shared";
import { api, json } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { starredMessages } from "@/server/chat/service";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  const params = new URL(request.url).searchParams;
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || LIMITS.PAGE_SIZE_DEFAULT));
  return json(await starredMessages(user, params.get("cursor"), limit));
});
