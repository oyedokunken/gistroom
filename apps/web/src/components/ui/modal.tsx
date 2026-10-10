"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./icon-button";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Hide the corner close button (used by blocking confirm dialogs). */
  hideClose?: boolean;
  className?: string;
}

/** Focus is trapped and Escape closes, both from Radix Dialog (R19). */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  hideClose,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/55 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface p-6 shadow-lift",
            "transition-[opacity,transform] data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
            className,
          )}
        >
          <Dialog.Title className="pr-10 text-xl font-bold leading-tight text-text">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-base text-text-muted">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
          {hideClose ? null : (
            <Dialog.Close asChild>
              <IconButton label={ui.close} className="absolute right-3 top-3">
                <X aria-hidden className="size-5" />
              </IconButton>
            </Dialog.Close>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
