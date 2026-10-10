/**
 * The 16 illustrated avatars (design/masters/avatars). A person without a photo gets one of them, chosen from
 * their user id so it never changes. An uploaded photo always wins over this (Section 17).
 */
export const AVATAR_COUNT = 16;

/** Demo people for the public pages and mockups. Each name keeps the same face everywhere. */
export const DEMO_PEOPLE = [
  "Ada",
  "Tunde",
  "Emeka",
  "Zainab",
  "Chidi",
  "Ngozi",
  "Bayo",
  "Hauwa",
  "Kemi",
  "Ifeanyi",
  "Funke",
  "Musa",
  "Amaka",
  "Seun",
  "Halima",
  "Obinna",
] as const;
export type DemoPerson = (typeof DEMO_PEOPLE)[number];

/** FNV-1a, so the same id always lands on the same avatar on every device and every server. */
export function avatarIndex(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % AVATAR_COUNT;
}

const file = (index: number) => `/images/avatars/avatar-${String(index + 1).padStart(2, "0")}.png`;

/** Default avatar picture for a user id. */
export function defaultAvatarSrc(userId: string): string {
  return file(avatarIndex(userId));
}

/** The avatar that belongs to a demo name. */
export function demoAvatarSrc(name: DemoPerson): string {
  return file(DEMO_PEOPLE.indexOf(name));
}

export function isDefaultAvatar(src: string | null | undefined): boolean {
  return Boolean(src && src.startsWith("/images/avatars/avatar-"));
}
