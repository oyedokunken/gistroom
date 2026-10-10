import { avatarCommitSchema } from "@gistroom/shared";
import { api, assertSameOrigin, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { commitAvatar, removeAvatar } from "@/server/people/avatar";

export const POST = api(async (request) => {
  const { user } = await requireUser();
  const { assetId } = await parseJson(request, avatarCommitSchema);
  return json(await commitAvatar(user, assetId));
});

export const DELETE = api(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  await removeAvatar(user);
  return json({ ok: true });
});
