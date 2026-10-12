import { describe, expect, it } from "vitest";
import { updateBlockers } from "../../apps/web/src/lib/update-gate";

const none = { ringing: false, drafts: {} };

describe("when a new version may be applied", () => {
  it("is free to apply on an ordinary page", () => {
    expect(updateBlockers({ pathname: "/app/discover", ...none })).toEqual([]);
    expect(updateBlockers({ pathname: "/app/rooms", ...none })).toEqual([]);
    expect(updateBlockers({ pathname: "/app/chats/abc", ...none })).toEqual([]);
  });

  it("waits during a call, whether it is on screen or only ringing", () => {
    expect(updateBlockers({ pathname: "/app/call/xyz", ...none })).toEqual(["call"]);
    expect(updateBlockers({ pathname: "/app/chats", ringing: true, drafts: {} })).toEqual(["call"]);
  });

  it("waits inside a live room but not on the room list", () => {
    expect(updateBlockers({ pathname: "/app/rooms/k3m9", ...none })).toEqual(["room"]);
    expect(updateBlockers({ pathname: "/app/rooms", ...none })).toEqual([]);
  });

  it("waits while there is unsent text, and ignores empty drafts", () => {
    expect(
      updateBlockers({ pathname: "/app/chats", ringing: false, drafts: { a: "hello" } }),
    ).toEqual(["draft"]);
    expect(
      updateBlockers({ pathname: "/app/chats", ringing: false, drafts: { a: "   ", b: "" } }),
    ).toEqual([]);
  });

  it("can name several reasons at once", () => {
    expect(
      updateBlockers({ pathname: "/app/call/xyz", ringing: false, drafts: { a: "typing" } }),
    ).toEqual(["call", "draft"]);
  });
});
