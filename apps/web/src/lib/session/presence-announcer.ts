/**
 * Decides which "joined" and "left" notices a room shows. Pure, with the clock and timers passed in, so it can be tested.
 *
 * - You are never announced to yourself.
 * - A person who drops and comes back inside 10 seconds is "reconnected", never "left" followed by "joined".
 * - A leave is only announced once the 10 second reconnect window has passed.
 * - In a crowd (above `crowd`) only counts are shown, never names.
 */

export type Announcement =
  | { kind: "joined"; name: string }
  | { kind: "left"; name: string }
  | { kind: "reconnected"; name: string };

export interface AnnouncerDeps {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  announce: (a: Announcement) => void;
}

/** How long a leave waits before it counts, in case the person comes straight back. */
export const RECONNECT_WINDOW_MS = 10_000;

export class PresenceAnnouncer {
  private pendingLeaves = new Map<string, unknown>();
  private known = new Set<string>();

  constructor(
    private readonly deps: AnnouncerDeps,
    private readonly selfId: () => string | null,
  ) {}

  /** The people who are in the room when you arrive are not announced. */
  seed(identities: readonly string[]): void {
    for (const id of identities) this.known.add(id);
  }

  joined(identity: string, name: string): void {
    if (identity === this.selfId()) return;
    const pending = this.pendingLeaves.get(identity);
    if (pending !== undefined) {
      this.deps.clearTimeout(pending);
      this.pendingLeaves.delete(identity);
      this.known.add(identity);
      this.deps.announce({ kind: "reconnected", name });
      return;
    }
    if (this.known.has(identity)) return;
    this.known.add(identity);
    this.deps.announce({ kind: "joined", name });
  }

  left(identity: string, name: string): void {
    if (identity === this.selfId()) return;
    if (this.pendingLeaves.has(identity)) return;
    const id = this.deps.setTimeout(() => {
      this.pendingLeaves.delete(identity);
      this.known.delete(identity);
      this.deps.announce({ kind: "left", name });
    }, RECONNECT_WINDOW_MS);
    this.pendingLeaves.set(identity, id);
  }

  dispose(): void {
    for (const id of this.pendingLeaves.values()) this.deps.clearTimeout(id);
    this.pendingLeaves.clear();
    this.known.clear();
  }
}
