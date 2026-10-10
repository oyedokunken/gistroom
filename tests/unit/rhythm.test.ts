import { describe, expect, it } from "vitest";
import { clashes, rhythm } from "../../apps/web/src/lib/rhythm";

describe("section background rhythm", () => {
  for (const [page, tones] of Object.entries(rhythm)) {
    it(`${page} never puts two strong backgrounds next to each other`, () => {
      expect(clashes(tones)).toEqual([]);
    });
  }
  it("catches a clash when there is one", () => {
    expect(clashes(["green", "green"])).toEqual([[0, 1]]);
    expect(clashes(["ink", "plain", "ink"])).toEqual([]);
    expect(clashes(["plain", "plain"])).toEqual([]);
  });
  it("puts the features numbers on black, away from the green neighbours", () => {
    expect(rhythm.features[3]).toBe("ink");
  });
});
