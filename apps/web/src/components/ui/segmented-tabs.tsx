"use client";

import { cn } from "@/lib/cn";

export interface SegmentedOption {
  value: string;
  label: string;
}

/** Two or three way switch for filters (not a page level tab list). Radio semantics, 44px targets. */
export function SegmentedTabs({
  label,
  value,
  onChange,
  options,
  className,
  optionClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SegmentedOption[];
  className?: string;
  optionClassName?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex gap-1 rounded-full bg-surface-2 p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 min-w-0 rounded-full px-4 text-sm font-semibold transition-colors",
            value === o.value ? "bg-surface text-green-700 shadow-soft" : "text-text-muted",
            optionClassName,
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
