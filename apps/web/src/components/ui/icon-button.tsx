import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls must be labelled (R19). */
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full text-text transition-colors hover:bg-surface-2",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
