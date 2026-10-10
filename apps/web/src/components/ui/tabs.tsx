"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Tabs = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

export function TabsList({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixTabs.List
      aria-label={label}
      className={cn("inline-flex gap-1 rounded-full bg-surface-2 p-1", className)}
    >
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className="min-h-11 rounded-full px-4 text-sm font-semibold text-text-muted transition-colors data-[state=active]:bg-surface data-[state=active]:text-green-700 data-[state=active]:shadow-soft"
    >
      {children}
    </RadixTabs.Trigger>
  );
}
