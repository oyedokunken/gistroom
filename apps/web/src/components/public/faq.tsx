import { ChevronDown } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Native details elements: keyboard and screen reader friendly with no script. Two columns on desktop. The shared `name` makes a group exclusive: opening one closes the others. */
export function Faq({ items, name = "faq" }: { items: readonly FaqItem[]; name?: string }) {
  const mid = Math.ceil(items.length / 2);
  const columns = [items.slice(0, mid), items.slice(mid)];
  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      {columns.map((column, i) => (
        <div key={i} className="flex flex-col gap-3">
          {column.map((item) => (
            <details
              key={item.question}
              name={name}
              className="group rounded-card border border-border bg-surface px-5 transition-colors hover:border-yellow-400 hover:bg-yellow-400 open:border-green-600 open:bg-green-600 open:hover:border-green-600 open:hover:bg-green-600"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-lg font-semibold text-text group-hover:text-ink-950 group-open:text-white group-open:group-hover:text-white">
                {item.question}
                <ChevronDown
                  aria-hidden
                  className="size-5 shrink-0 text-text-muted transition-transform group-hover:text-ink-950 group-open:rotate-180 group-open:text-white group-open:group-hover:text-white"
                />
              </summary>
              <p className="max-w-[68ch] pb-5 text-text-muted group-open:text-white/90">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}
