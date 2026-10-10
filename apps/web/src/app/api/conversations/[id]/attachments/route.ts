import { finalizeUploadSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { finalizeChatUpload } from "@/server/chat/media";

export const POST = api(async (request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, finalizeUploadSchema);
  const { message, created } = await finalizeChatUpload(user, (await ctx.params).id, input);
  return json({ message }, { status: created ? 201 : 200 });
});
