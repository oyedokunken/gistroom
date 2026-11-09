import { getDb } from "@gistroom/db";
import { updateProfileSchema } from "@gistroom/shared";
import { api, json, parseJson } from "@/server/http";
import { rejectLockedFields } from "@/server/users/locked-fields";
import { requireUser } from "@/server/auth/session";
import { toMe } from "@/server/users/serialize";

export const GET = api(async () => {
  const { user } = await requireUser();
  return json({ user: toMe(user) });
});

export const PATCH = api(async (request) => {
  const { user } = await requireUser();
  // Email and username are permanent: a request that names either one is refused, not quietly ignored.
  rejectLockedFields(
    await request
      .clone()
      .json()
      .catch(() => null),
  );
  const input = await parseJson(request, updateProfileSchema);
  const updated = await getDb().user.update({
    where: { id: user.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.bio !== undefined && { bio: input.bio === "" ? null : input.bio }),
      ...(input.discoverable !== undefined && { discoverable: input.discoverable }),
      ...(input.showPresence !== undefined && { showPresence: input.showPresence }),
      ...(input.sendReadReceipts !== undefined && { sendReadReceipts: input.sendReadReceipts }),
      ...(input.roomInvitesFrom !== undefined && { roomInvitesFrom: input.roomInvitesFrom }),
      ...(input.dataSaver !== undefined && { dataSaver: input.dataSaver }),
      ...(input.showBadges !== undefined && { showBadges: input.showBadges }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
    },
  });
  return json({ user: toMe(updated) });
});
