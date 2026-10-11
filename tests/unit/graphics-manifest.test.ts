import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync("design/assets.manifest.json", "utf8")) as {
  assets: { id: string; alt: string; decorative?: boolean; status: string }[];
};

const required = ["hero-back", "hero-mid", "hero-front", "scene-final-cta", "scene-moderators"];

describe("graphics manifest", () => {
  it("ships no pattern placeholders", () => {
    expect(manifest.assets.filter((a) => a.status === "PLACEHOLDER")).toEqual([]);
  });
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
