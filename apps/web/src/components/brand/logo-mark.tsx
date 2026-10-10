import { colors } from "@/lib/tokens";

export interface LogoMarkProps {
  size?: number;
  /** Bubble color. Defaults to the current text color so it flips in dark mode. */
  bubble?: string;
  className?: string;
}

/** The Gistroom mark (R3 exception): a speech bubble shaped like a lowercase g with three sound bars. */
export function LogoMark({ size = 32, bubble = "currentColor", className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="236" cy="236" r="150" fill={bubble} />
      <path
        d="M372 150 V318 Q372 410 272 410 H190"
        fill="none"
        stroke={bubble}
        strokeWidth="64"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M170 392 L128 452 L212 432 Z" fill={bubble} />
      <rect x="172" y="196" width="34" height="80" rx="17" fill={colors.green600} />
      <rect x="219" y="150" width="34" height="172" rx="17" fill={colors.yellow400} />
      <rect x="266" y="178" width="34" height="116" rx="17" fill={colors.green600} />
    </svg>
  );
}
