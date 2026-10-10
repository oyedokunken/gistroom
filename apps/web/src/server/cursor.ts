/** Opaque keyset cursors. Offsets are never used (Section 5.3). */
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T>(
  cursor: string | null | undefined,
  guard: (v: unknown) => v is T,
): T | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Escape LIKE wildcards so a person cannot search with % or _ as patterns. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Canonical order for a pair of ids, matching the Friendship table. */
export function orderedPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export function dmKeyFor(a: string, b: string): string {
  const { low, high } = orderedPair(a, b);
  return `${low}:${high}`;
}
