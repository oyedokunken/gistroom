import { getDb } from "@gistroom/db";
import { updateProfileSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { changeUsername } from "@/server/account/service";
import { toMe } from "@/server/users/serialize";

export const GET = api(async () => {
  const { user } = await requireUser();
  return json({ user: toMe(user) });
});

export const PATCH = api(async (request) => {
  const { user } = await requireUser();
  const input = await parseJson(request, updateProfileSchema);
  const renamed = input.username !== undefined ? await changeUsername(user, input.username) : user;
  const updated = await getDb().user.update({
    where: { id: renamed.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.bio !== undefined && { bio: input.bio === "" ? null : input.bio }),
      ...(input.discoverable !== undefined && { discoverable: input.discoverable }),
      ...(input.showPresence !== undefined && { showPresence: input.showPresence }),
      ...(input.sendReadReceipts !== undefined && { sendReadReceipts: input.sendReadReceipts }),
      ...(input.roomInvitesFrom !== undefined && { roomInvitesFrom: input.roomInvitesFrom }),
      ...(input.dataSaver !== undefined && { dataSaver: input.dataSaver }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
    },
  });
  return json({ user: toMe(updated) });
});
