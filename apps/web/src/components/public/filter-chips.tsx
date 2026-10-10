import Link from "next/link";
import { cn } from "@/lib/cn";

export interface Chip {
  label: string;
  href: string;
  active: boolean;
}

/** Filter links. Real links, so filters work without script and can be shared (no native select, R6). */
export function FilterChips({ label, chips }: { label: string; chips: readonly Chip[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <Link
          key={c.href + c.label}
          href={c.href}
          aria-current={c.active ? "true" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
            c.active
              ? "border-green-600 bg-green-600 text-white"
              : "border-border text-text hover:bg-surface-2",
          )}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
