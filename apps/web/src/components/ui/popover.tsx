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
}: {
  children: ReactNode;
  className?: string;
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
        className={cn("z-50 rounded-card border border-border bg-surface shadow-lift", className)}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
