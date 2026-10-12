"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./icon-button";
import { cn } from "@/lib/cn";
import { ui } from "@/content/ui";

export type ModalTone = "neutral" | "info" | "error" | "success";

const badge: Record<ModalTone, string> = {
  neutral: "bg-green-100 text-green-700",
  info: "bg-green-100 text-green-700",
  success: "bg-green-100 text-green-700",
  error: "bg-danger-600/10 text-danger-600",
};

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Shown in a round tinted badge above the title. Every modal has one. */
  icon: LucideIcon;
  tone?: ModalTone;
  children?: ReactNode;
  footer?: ReactNode;
  /** Hide the corner close button (used by blocking confirm dialogs). */
  hideClose?: boolean;
  className?: string;
}

/**
 * One layout for every modal: icon on top, then the title, the text, the content and the actions, all centred.
 * Focus is trapped and Escape closes, both from Radix Dialog (R19).
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  tone = "neutral",
  children,
  footer,
  hideClose,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-ink-950/55 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity" />
        <Dialog.Content
          data-modal
          className={cn(
            "fixed left-1/2 top-1/2 z-[70] flex max-h-[90dvh] w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center overflow-y-auto rounded-card bg-surface p-6 text-center shadow-lift",
            "transition-[opacity,transform] data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
            className,
          )}
        >
          <span
            data-modal-icon
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full",
              badge[tone],
            )}
          >
            <Icon aria-hidden className="size-7" />
          </span>
          <Dialog.Title data-modal-title className="mt-4 text-xl font-bold leading-tight text-text">
            {title}
          </Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-base text-text-muted">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          {children ? <div className="mt-4 w-full text-left">{children}</div> : null}
          {footer ? (
            <div className="mt-6 flex w-full flex-wrap justify-center gap-3">{footer}</div>
          ) : null}
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
