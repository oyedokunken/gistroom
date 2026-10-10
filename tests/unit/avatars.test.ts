import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AVATAR_COUNT,
  DEMO_PEOPLE,
  avatarIndex,
  defaultAvatarSrc,
  demoAvatarSrc,
  isDefaultAvatar,
} from "../../packages/shared/src";

describe("illustrated avatars", () => {
  it("picks the same avatar for the same user id, every time", () => {
    expect(defaultAvatarSrc("user_abc")).toBe(defaultAvatarSrc("user_abc"));
    for (const id of ["a", "b", "cm9x2k1", "user_999"]) {
      const i = avatarIndex(id);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(AVATAR_COUNT);
    }
  });
  it("spreads people across all sixteen faces", () => {
    const seen = new Set(Array.from({ length: 400 }, (_, i) => avatarIndex(`user_${i}`)));
    expect(seen.size).toBe(AVATAR_COUNT);
  });
  it("keeps each demo name tied to one face and ships every file", () => {
    expect(DEMO_PEOPLE).toHaveLength(AVATAR_COUNT);
    const files = DEMO_PEOPLE.map((n) => demoAvatarSrc(n));
    expect(new Set(files).size).toBe(AVATAR_COUNT);
    for (const f of files) {
      expect(existsSync(path.join(process.cwd(), "apps", "web", "public", f))).toBe(true);
      expect(isDefaultAvatar(f)).toBe(true);
    }
    expect(isDefaultAvatar("https://x.supabase.co/storage/v1/object/public/avatars/u/1.jpg")).toBe(
      false,
    );
  });
});
