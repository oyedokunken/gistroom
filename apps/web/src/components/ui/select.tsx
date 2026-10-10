"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { ui } from "@/content/ui";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** The only select control in the app (R6). */
export function Select({
  id,
  value,
  onValueChange,
  options,
  placeholder = ui.selectPlaceholder,
  className,
  ...aria
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        id={id}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-input border border-border bg-surface px-4 text-base text-text",
          "aria-[invalid=true]:border-danger-600 data-[placeholder]:text-text-muted",
          className,
        )}
        {...aria}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown aria-hidden className="size-4" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-input border border-border bg-surface shadow-soft"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex min-h-11 cursor-pointer select-none items-center rounded-lg py-2 pl-9 pr-3 text-base text-text data-[highlighted]:bg-green-100 data-[highlighted]:text-green-700 data-[highlighted]:outline-none"
              >
                <RadixSelect.ItemIndicator className="absolute left-3">
                  <Check aria-hidden className="size-4" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
