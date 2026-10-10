import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync("design/assets.manifest.json", "utf8")) as {
  assets: { id: string; alt: string; decorative?: boolean; status: string }[];
};

const required = [
  "hero-back",
  "hero-mid",
  "hero-front",
  "auth-login",
  "auth-signup",
  "auth-verify",
  "auth-onboarding",
  "how-1",
  "how-2",
  "how-3",
  "how-4",
  "safety",
  "nigeria-data",
  "final-cta",
  "discover-backdrop",
  "empty-chat",
  "empty-friends",
  "empty-requests",
  "empty-calls",
  "empty-rooms",
  "empty-notifications",
  "empty-search",
  "empty-archived",
  "empty-starred",
  "empty-media",
  "offline",
  "error-500",
  "not-found",
  "room-ended",
  "room-full",
  "not-invited",
  "install-ios",
  "install-android",
];

describe("graphics manifest", () => {
  it("lists every required asset exactly once", () => {
    const ids = manifest.assets.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of required) expect(ids).toContain(id);
  });
  it("has alt text unless the asset is decorative", () => {
    for (const a of manifest.assets) expect(a.alt !== "" || a.decorative === true).toBe(true);
  });
  it("only uses known statuses", () => {
    for (const a of manifest.assets)
      expect(["PLACEHOLDER", "DRAFT", "APPROVED"]).toContain(a.status);
  });
});
