import { Mic, Paperclip, Smile } from "lucide-react";
import { chat } from "@/content/chat";
import { cn } from "@/lib/cn";

/**
 * The chat composer in display-only demo mode: the same controls, spacing and field style as the real one
 * (attach, text field, emoji, voice note), with nothing wired up. It cannot send, so it is hidden from screen readers.
 */
export function ComposerDemo({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("flex items-end gap-1 border-t border-border bg-surface px-2 py-2", className)}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-text">
        <Smile className="size-5" />
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-text">
        <Paperclip className="size-5" />
      </span>
      <span className="flex min-h-9 flex-1 items-center rounded-[1.375rem] bg-surface-2 px-3 text-sm text-text-muted">
        {chat.composerPlaceholder}
      </span>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
        <Mic className="size-4" />
      </span>
    </div>
  );
}
