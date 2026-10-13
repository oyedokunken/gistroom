import { SignalHigh, SignalLow, SignalMedium, SignalZero } from "lucide-react";
import { session as copy } from "@/content/session";
import { cn } from "@/lib/cn";
import type { QualityLabel } from "@/lib/live/live-session";

const icons = {
  excellent: SignalHigh,
  good: SignalHigh,
  poor: SignalLow,
  lost: SignalZero,
  unknown: SignalMedium,
} as const;

const labels: Record<QualityLabel, string> = {
  excellent: copy.signal.excellent,
  good: copy.signal.good,
  poor: copy.signal.poor,
  lost: copy.signal.lost,
  unknown: copy.signal.unknown,
};

/**
 * How strong someone's connection is: a signal icon and a word, never colour alone. Excellent and Good look alike on
 * purpose, because the difference does not matter to a listener. The text is there for screen readers and for the tooltip.
 */
export function SignalBars({
  quality,
  className,
  showLabel = false,
}: {
  quality: QualityLabel;
  className?: string;
  showLabel?: boolean;
}) {
  const Icon = icons[quality];
  const text = labels[quality];
  return (
    <span
      title={copy.signal.label(text)}
      className={cn(
        "inline-flex items-center gap-1",
        quality === "poor" && "text-yellow-400",
        quality === "lost" && "text-danger-600",
        className,
      )}
    >
      <Icon aria-hidden className="size-4" />
      <span className={showLabel ? "text-xs" : "sr-only"}>{copy.signal.label(text)}</span>
    </span>
  );
}
