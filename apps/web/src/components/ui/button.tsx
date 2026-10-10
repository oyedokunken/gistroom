import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-green-600 text-white hover:bg-green-700 active:bg-green-700",
  secondary: "bg-green-100 text-green-700 hover:bg-green-100/70",
  accent: "bg-yellow-400 text-ink-950 hover:bg-yellow-400/85",
  ghost: "bg-transparent text-text hover:bg-surface-2",
  danger: "bg-danger-600 text-white hover:bg-danger-600/90",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    icon,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-[0.9375rem] font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
      {loading ? <span className="sr-only">{ui.loading}</span> : null}
    </button>
  );
});
