"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export const DropdownMenu = Menu.Root;
export const DropdownTrigger = Menu.Trigger;

export function DropdownContent({
  children,
  align = "end",
  className,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 rounded-input border border-border bg-surface p-1 shadow-lift",
          className,
        )}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownItem({
  icon: Icon,
  children,
  onSelect,
  danger,
  disabled,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-base outline-none",
        "data-[highlighted]:bg-green-100 data-[highlighted]:text-green-700 data-[disabled]:opacity-50",
        danger ? "text-danger-600" : "text-text",
      )}
    >
      {Icon ? <Icon aria-hidden className="size-4" /> : null}
      {children}
    </Menu.Item>
  );
}

export const DropdownSeparator = () => <Menu.Separator className="my-1 h-px bg-border" />;
