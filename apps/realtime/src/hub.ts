export interface SocketMeta {
  userId: string;
  sessionId: string;
  /** The tab is visible and focused. Push is skipped only for these (Section 10.1). */
  focused: boolean;
}

/** In memory registry of live sockets. Single instance for now: scaling out needs the Redis adapter (wiki/Realtime.md). */
export class Hub {
  private byUser = new Map<string, Map<string, SocketMeta>>();
  private bySocket = new Map<string, SocketMeta>();

  /** Returns true when this is the person's first live socket, so presence should flip to online. */
  add(socketId: string, meta: SocketMeta): boolean {
    const mine = this.byUser.get(meta.userId) ?? new Map<string, SocketMeta>();
    const first = mine.size === 0;
    mine.set(socketId, meta);
    this.byUser.set(meta.userId, mine);
    this.bySocket.set(socketId, meta);
    return first;
  }

  /** Returns the person and whether that was their last socket. */
  remove(socketId: string): { userId: string; last: boolean } | null {
    const meta = this.bySocket.get(socketId);
    if (!meta) return null;
    this.bySocket.delete(socketId);
    const mine = this.byUser.get(meta.userId);
    mine?.delete(socketId);
    const last = !mine || mine.size === 0;
    if (last) this.byUser.delete(meta.userId);
    return { userId: meta.userId, last };
  }

  setFocused(socketId: string, focused: boolean): void {
    const meta = this.bySocket.get(socketId);
    if (meta) meta.focused = focused;
  }

  isOnline(userId: string): boolean {
    return (this.byUser.get(userId)?.size ?? 0) > 0;
  }

  hasFocused(userId: string): boolean {
    for (const meta of this.byUser.get(userId)?.values() ?? []) if (meta.focused) return true;
    return false;
  }

  socketIds(userId: string): string[] {
    return [...(this.byUser.get(userId)?.keys() ?? [])];
  }

  onlineCount(): number {
    return this.byUser.size;
  }
}

export const userRoom = (userId: string) => `user:${userId}`;
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;
