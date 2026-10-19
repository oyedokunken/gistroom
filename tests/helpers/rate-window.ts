/**
 * The database rate limiter counts in fixed windows, so two calls that straddle a window edge are counted
 * separately and the second one is allowed (see the operations notes in the README). A test that expects the Nth
 * call in a window to be refused would fail by chance when the window rolls over half way. Call this first: it
 * waits for the next window when too little of the current one is left for the whole sequence.
 */
export async function waitForWindowRoom(
  windowSec: number,
  needMs: number,
  now: () => number = Date.now,
): Promise<void> {
  const windowMs = windowSec * 1000;
  const left = windowMs - (now() % windowMs);
  if (left < needMs) await new Promise((resolve) => setTimeout(resolve, left + 100));
}
