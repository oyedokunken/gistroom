import type { ReactionDto } from "@gistroom/shared";

/**
 * What the reaction row looks like after you tap an emoji, before the server answers.
 * Tapping an emoji you already used takes it back. The server result replaces this when it arrives.
 */
export function toggleReactionLocal(
  reactions: readonly ReactionDto[],
  emoji: string,
): ReactionDto[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (!existing) return [...reactions, { emoji, count: 1, mine: true }];
  if (existing.mine) {
    return reactions
      .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r))
      .filter((r) => r.count > 0);
  }
  return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
}
