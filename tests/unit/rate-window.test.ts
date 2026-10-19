import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForWindowRoom } from "../helpers/rate-window";

describe("waitForWindowRoom", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns at once when enough of the window is left", async () => {
    // 5 seconds into a 30 second window leaves 25 seconds.
    await waitForWindowRoom(30, 20_000, () => 30_000 * 7 + 5_000);
  });

  it("waits for the next window when too little is left", async () => {
    let settled = false;
    // 25 seconds in leaves 5 seconds, and 20 are needed.
    const wait = waitForWindowRoom(30, 20_000, () => 30_000 * 7 + 25_000).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    await wait;
    expect(settled).toBe(true);
  });
});
