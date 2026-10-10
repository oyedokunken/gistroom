import { api } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { attachmentLink } from "@/server/chat/media";

export const dynamic = "force-dynamic";

/** Opens one attachment after checking you are in the conversation. ?thumb=1 gives the small preview. */
export const GET = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const thumb = new URL(request.url).searchParams.get("thumb") === "1";
  const url = await attachmentLink(user, (await ctx.params).id, thumb);
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, max-age=240" },
  });
});
