import { avatarSignSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { signAvatarUpload } from "@/server/people/avatar";

export const POST = api(async (request) => {
  const { user } = await requireUser();
  const input = await parseJson(request, avatarSignSchema);
  return json(await signAvatarUpload(user, input));
});
