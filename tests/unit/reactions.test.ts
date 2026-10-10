import { describe, expect, it } from "vitest";
import { toggleReactionLocal } from "../../apps/web/src/lib/chat/reactions";

const thumb = "\u{1F44D}";
const joy = "\u{1F602}";

describe("toggleReactionLocal", () => {
  it("adds a first reaction as mine", () => {
    expect(toggleReactionLocal([], thumb)).toEqual([{ emoji: thumb, count: 1, mine: true }]);
  });
  it("joins a reaction the other person already made", () => {
    expect(toggleReactionLocal([{ emoji: thumb, count: 1, mine: false }], thumb)).toEqual([
      { emoji: thumb, count: 2, mine: true },
    ]);
  });
  it("takes your own reaction back and drops it at zero", () => {
    expect(toggleReactionLocal([{ emoji: thumb, count: 1, mine: true }], thumb)).toEqual([]);
    expect(toggleReactionLocal([{ emoji: thumb, count: 2, mine: true }], thumb)).toEqual([
      { emoji: thumb, count: 1, mine: false },
    ]);
  });
  it("keeps other emoji untouched", () => {
    const start = [{ emoji: joy, count: 1, mine: false }];
    expect(toggleReactionLocal(start, thumb)).toEqual([
      { emoji: joy, count: 1, mine: false },
      { emoji: thumb, count: 1, mine: true },
    ]);
  });
});
