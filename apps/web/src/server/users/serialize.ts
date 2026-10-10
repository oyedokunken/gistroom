import type { User } from "@gistroom/db";
import { toPublicUser } from "@gistroom/db";
import type { MeUser } from "@gistroom/shared";

export { avatarUrl, toPublicUser } from "@gistroom/db";

export function toMe(user: User): MeUser {
  return {
    ...toPublicUser(user),
    email: user.email,
    role: user.role,
    onboarded: user.onboardedAt !== null,
    discoverable: user.discoverable,
    showPresence: user.showPresence,
    sendReadReceipts: user.sendReadReceipts,
    roomInvitesFrom: user.roomInvitesFrom,
    dataSaver: user.dataSaver,
    timezone: user.timezone,
  };
}
