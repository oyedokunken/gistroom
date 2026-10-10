import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-400 text-ink-950",
  neutral: "bg-surface-2 text-text",
  danger: "bg-danger-600 text-white",
} as const;

export function Badge({
  tone = "green",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
