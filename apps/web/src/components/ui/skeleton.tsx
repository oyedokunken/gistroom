import { cn } from "@/lib/cn";

/** Loading placeholder. The pulse is opacity only and reduced motion switches it off. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-input bg-surface-2", className)} />;
}
