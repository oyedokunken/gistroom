"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

export function PopoverContent({
  children,
  className,
  align = "end",
  side = "top",
  keepOpenOnFocusOutside = false,
}: {
  children: ReactNode;
  className?: string;
  /** Keep the popover open when focus moves elsewhere, for example into a text box. Clicking outside still closes it. */
  keepOpenOnFocusOutside?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={12}
        onFocusOutside={keepOpenOnFocusOutside ? (e) => e.preventDefault() : undefined}
        className={cn("z-[70] rounded-card border border-border bg-surface shadow-lift", className)}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
