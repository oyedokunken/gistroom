import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Text, or text with links such as the Terms. */
  label: ReactNode;
  error?: string;
}

/** Native checkbox, so it works with React Hook Form register. Validation is Zod, never HTML (R5). */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, className, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? `cb-${generated}`;
  const errorId = `${fieldId}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={fieldId}
        className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-text"
      >
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn("size-5 shrink-0 cursor-pointer accent-green-600", className)}
          {...rest}
        />
        {label}
      </label>
      {error ? (
        <p id={errorId} role="alert" className="pl-8 text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
});
