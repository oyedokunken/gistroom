import { ChevronDown } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Native details elements: keyboard and screen reader friendly with no script. */
export function Faq({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-card border border-border">
      {items.map((item) => (
        <details key={item.question} className="group px-5">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-lg font-semibold text-text">
            {item.question}
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="max-w-[68ch] pb-5 text-text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
