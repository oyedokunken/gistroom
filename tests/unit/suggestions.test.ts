import { describe, expect, it } from "vitest";
import {
  SUGGESTION_LIMIT,
  rankSuggestions,
  suggestable,
  suggestionReasons,
  suggestionScore,
  type SuggestionEligibility,
  type SuggestionSignals,
} from "../../packages/shared/src/suggestions";

const sig = (over: Partial<SuggestionSignals> = {}): SuggestionSignals => ({
  sharedInterests: [],
  mutualFriends: 0,
  publicRoomsTogether: 0,
  ...over,
});

describe("suggestion score", () => {
  it("weighs mutual friends above interests above rooms, with visible weights", () => {
    expect(suggestionScore(sig({ sharedInterests: ["a"] }))).toBe(3);
    expect(suggestionScore(sig({ mutualFriends: 1 }))).toBe(4);
    expect(suggestionScore(sig({ publicRoomsTogether: 1 }))).toBe(2);
    expect(
      suggestionScore(
        sig({ sharedInterests: ["a", "b"], mutualFriends: 2, publicRoomsTogether: 1 }),
      ),
    ).toBe(16);
  });
  it("caps mutual friends and rooms so one signal cannot drown the rest", () => {
    expect(suggestionScore(sig({ mutualFriends: 500 }))).toBe(40);
    expect(suggestionScore(sig({ publicRoomsTogether: 500 }))).toBe(10);
  });
  it("is zero with no signal and never negative", () => {
    expect(suggestionScore(sig())).toBe(0);
    expect(suggestionScore(sig({ mutualFriends: -4, publicRoomsTogether: -1 }))).toBe(0);
  });
});

describe("ranking", () => {
  const person = (id: string, signals: SuggestionSignals) => ({ id, signals });
  it("puts the highest score first and breaks ties by id, the same every time", () => {
    const list = [
      person("c", sig({ sharedInterests: ["x"] })),
      person("a", sig({ sharedInterests: ["x"] })),
      person("b", sig({ mutualFriends: 3 })),
    ];
    const first = rankSuggestions(list).map((p) => p.id);
    const second = rankSuggestions([...list].reverse()).map((p) => p.id);
    expect(first).toEqual(["b", "a", "c"]);
    expect(second).toEqual(first);
  });
  it("drops people with no signal and caps the list", () => {
    expect(rankSuggestions([person("z", sig())])).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) =>
      person(`p${String(i).padStart(2, "0")}`, sig({ mutualFriends: 1 })),
    );
    expect(rankSuggestions(many)).toHaveLength(SUGGESTION_LIMIT);
    expect(rankSuggestions(many, 3)).toHaveLength(3);
  });
});

describe("reasons", () => {
  it("states only plain, visible facts", () => {
    expect(suggestionReasons(sig({ mutualFriends: 1 }))).toEqual(["1 mutual friend"]);
    expect(
      suggestionReasons(
        sig({ mutualFriends: 3, sharedInterests: ["a", "b"], publicRoomsTogether: 2 }),
      ),
    ).toEqual(["3 mutual friends", "2 interests in common", "Often in the same public rooms"]);
    expect(suggestionReasons(sig())).toEqual([]);
  });
  it("never mentions private rooms, locations or languages", () => {
    const all = suggestionReasons(
      sig({ mutualFriends: 2, sharedInterests: ["a"], publicRoomsTogether: 4 }),
    ).join(" ");
    expect(all).not.toMatch(/private|location|near|city|language|invited/i);
  });
});

describe("who may be suggested", () => {
  const ok: SuggestionEligibility = {
    isSelf: false,
    isFriend: false,
    blockedEitherWay: false,
    dismissed: false,
    requestPending: false,
    requestCooldown: false,
    status: "ACTIVE",
    discoverable: true,
    onboarded: true,
    isInternal: false,
    viewerIsInternal: false,
  };
  it("allows an ordinary eligible person", () => {
    expect(suggestable(ok)).toBe(true);
  });
  it("leaves out every kind of person who must not appear", () => {
    const blockers: Partial<SuggestionEligibility>[] = [
      { isSelf: true },
      { isFriend: true },
      { blockedEitherWay: true },
      { dismissed: true },
      { requestPending: true },
      { requestCooldown: true },
      { status: "DELETED" },
      { status: "SUSPENDED" },
      { discoverable: false },
      { onboarded: false },
      { isInternal: true },
    ];
    for (const b of blockers) expect(suggestable({ ...ok, ...b })).toBe(false);
  });
  it("shows an internal account to another internal account only", () => {
    expect(suggestable({ ...ok, isInternal: true, viewerIsInternal: true })).toBe(true);
  });
});
