/** Token bucket. The clock is injected so tests do not need to wait. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((t - this.last) / 1000) * this.refillPerSec,
    );
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** Counts drops inside a sliding window. Repeated abuse means disconnect (Section 8). */
export class StrikeCounter {
  private hits: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Record a drop. Returns true when the socket has crossed the line. */
  strike(): boolean {
    const t = this.now();
    this.hits = this.hits.filter((h) => t - h < this.windowMs);
    this.hits.push(t);
    return this.hits.length >= this.limit;
  }
}

/** Limits from Section 8: 30 events per second burst, typing lower at 5 per second. */
export const SOCKET_LIMITS = {
  burst: { capacity: 30, refillPerSec: 30 },
  typing: { capacity: 5, refillPerSec: 5 },
  strikes: { limit: 20, windowMs: 10_000 },
} as const;
