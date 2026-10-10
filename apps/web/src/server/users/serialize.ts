import type { User } from "@gistroom/db";
import type { MeUser, PublicUser } from "@gistroom/shared";

/** Public avatar URL from the public bucket. Null when none is set or storage is not configured. */
export function avatarUrl(path: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  const bucket = process.env.SUPABASE_PUBLIC_BUCKET ?? "avatars";
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

type PublicFields = Pick<User, "id" | "name" | "username" | "avatarPath" | "bio" | "status">;

/** Only name, username, avatar and bio ever leave the server about another person. */
export function toPublicUser(user: PublicFields): PublicUser {
  if (user.status === "DELETED") {
    return { id: user.id, name: "Deleted user", username: "deleted", avatarUrl: null, bio: null };
  }
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: avatarUrl(user.avatarPath),
    bio: user.bio,
  };
}

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
