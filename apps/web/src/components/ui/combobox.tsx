"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra words that also match, for example a group name. */
  hint?: string;
}

export interface ComboboxProps {
  id?: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly ComboboxOption[];
  placeholder: string;
  searchLabel: string;
  emptyText: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** A searchable pick list. Same look as Select, with a search box on top (R6). */
export function Combobox({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  searchLabel,
  emptyText,
  className,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  function pick(o: ComboboxOption) {
    onValueChange(o.value);
    setOpen(false);
    setQuery("");
  }

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
        setActive(0);
      }}
    >
      <RadixPopover.Trigger
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-input border border-border bg-surface px-4 text-left text-base text-text",
          "aria-[invalid=true]:border-danger-600",
          !selected && "text-text-muted",
          className,
        )}
        {...aria}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0" />
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[70] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-input border border-border bg-surface shadow-soft"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search aria-hidden className="size-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              aria-label={searchLabel}
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              value={query}
              placeholder={searchLabel}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(shown.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const o = shown[active];
                  if (o) pick(o);
                }
              }}
              className="min-h-11 w-full bg-transparent py-2 text-base text-text placeholder:text-text-muted focus-visible:outline-none"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1">
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-sm text-text-muted">{emptyText}</li>
            ) : (
              shown.map((o, i) => (
                <li key={o.value} role="presentation">
                  <button
                    type="button"
                    tabIndex={-1}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={o.value === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o)}
                    className={cn(
                      "relative flex min-h-11 w-full cursor-pointer select-none items-center rounded-lg py-2 pl-9 pr-3 text-left text-base text-text",
                      i === active && "bg-green-100 text-green-700",
                    )}
                  >
                    {o.value === value ? (
                      <Check aria-hidden className="absolute left-3 size-4" />
                    ) : null}
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
