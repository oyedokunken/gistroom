"use client";

import { Drawer } from "vaul";
import type { ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Bottom sheet for mobile, draggable to dismiss. Use instead of popovers on small screens. */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-ink-950/55" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-hero bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift">
          <div aria-hidden className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
          <Drawer.Title className="text-xl font-bold text-text">{title}</Drawer.Title>
          <Drawer.Description className={description ? "mt-1 text-text-muted" : "sr-only"}>
            {description ?? title}
          </Drawer.Description>
          <div className="mt-4 overflow-y-auto">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
