import { signUploadSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireOnboarded } from "@/server/auth/session";
import { signChatUpload } from "@/server/chat/media";

export const POST = api(async (request) => {
  const { user } = await requireOnboarded();
  const input = await parseJson(request, signUploadSchema);
  return json(await signChatUpload(user, input));
});
