import { LIMITS, callLogQuerySchema, startCallSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { currentCall, listCallLogs, startCall } from "@/server/calls/service";

export const dynamic = "force-dynamic";

/** Call logs for the signed in person. With ?current=1 it returns the call in progress instead, if any. */
export const GET = api(async (request) => {
  const { user } = await requireOnboarded();
  const params = new URL(request.url).searchParams;
  if (params.get("current") === "1") return json({ current: await currentCall(user) });
  const q = callLogQuerySchema.parse({
    media: params.get("media") || undefined,
    outcome: params.get("outcome") || undefined,
    q: params.get("q") || undefined,
    limit: params.get("limit") || undefined,
    cursor: params.get("cursor") || undefined,
  });
  return json(
    await listCallLogs(user, {
      media: q.media,
      outcome: q.outcome,
      q: q.q,
      limit: q.limit ?? LIMITS.PAGE_SIZE_DEFAULT,
      cursor: q.cursor,
    }),
  );
});

export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, startCallSchema);
  return json(await startCall(user, input), { status: 201 });
});
