import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-input border bg-surface px-4 py-3 text-base text-text placeholder:text-text-muted " +
  "border-border focus-visible:border-green-600 aria-[invalid=true]:border-danger-600";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(control, "min-h-11", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return (
    <textarea ref={ref} rows={rows} className={cn(control, "resize-y", className)} {...rest} />
  );
});

export interface FieldProps {
  label: string;
  /** Optional element (for example a "Forgot password?" link) on the label row. */
  action?: ReactNode;
  help?: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
}

/** Label, help and inline error (R4: field errors sit under the field, never in a toast). */
export function Field({ label, action, help, error, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, help ? helpId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        {action}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {help ? (
        <p id={helpId} className="text-sm text-text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
