import type { ReactionDto } from "@gistroom/shared";
import { chat } from "@/content/chat";
import { cn } from "@/lib/cn";

/**
 * The emojis people reacted with, as small chips under a bubble. A number shows only when more than one
 * person chose that emoji. Your own reaction has a green outline. Without onToggle the chips are display only.
 */
export function ReactionChips({
  reactions,
  onToggle,
  className,
}: {
  reactions: readonly ReactionDto[];
  onToggle?: (emoji: string) => void;
  className?: string;
}) {
  if (reactions.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {reactions.map((r) => {
        const classes = cn(
          "tabular inline-flex min-h-7 items-center gap-1 rounded-full border bg-surface px-2 text-sm text-text",
          r.mine ? "border-2 border-green-600" : "border-border",
          onToggle && "cursor-pointer",
        );
        const inner = (
          <>
            <span aria-hidden={r.count > 1}>{r.emoji}</span>
            {r.count > 1 ? <span>{r.count}</span> : null}
          </>
        );
        return onToggle ? (
          <button
            type="button"
            key={r.emoji}
            aria-pressed={r.mine}
            aria-label={chat.reactedBy(r.emoji, r.count)}
            onClick={() => onToggle(r.emoji)}
            className={classes}
          >
            {inner}
          </button>
        ) : (
          <span key={r.emoji} className={classes}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}
