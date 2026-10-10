import { cn } from "@/lib/cn";

/** Labelled on/off control with a help line. role=switch, 44px target. */
export function Switch({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex flex-col">
        <span className="font-medium text-text">{label}</span>
        <span className="text-sm text-text-muted">{help}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-green-600" : "bg-border",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-soft transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
