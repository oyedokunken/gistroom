import { describe, expect, it } from "vitest";
import { LIMITS } from "../../packages/shared/src/limits";

describe("limits invariants", () => {
  it("video publishers never exceed Room size", () => {
    expect(LIMITS.ROOM_MAX_VIDEO_PUBLISHERS).toBeLessThanOrEqual(LIMITS.ROOM_MAX_PARTICIPANTS);
  });
  it("username regex follows the rules", () => {
    expect(LIMITS.USERNAME_REGEX.test("kenny_01")).toBe(true);
    expect(LIMITS.USERNAME_REGEX.test("Kenny")).toBe(false);
    expect(LIMITS.USERNAME_REGEX.test("ab")).toBe(false);
  });
});
