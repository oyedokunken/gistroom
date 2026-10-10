import { chat } from "@/content/chat";

/** The three dots a chat shows while the other person is typing. Dots stand still for reduced motion. */
export function TypingBubble({ name }: { name: string }) {
  return (
    <div
      role="status"
      aria-label={chat.typingBubble(name)}
      className="mt-2 flex w-full items-start"
    >
      <div className="flex min-h-11 items-center gap-1.5 rounded-bubble rounded-bl-[4px] bg-surface-2 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="size-2 rounded-full bg-text-muted motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
          />
        ))}
      </div>
    </div>
  );
}
