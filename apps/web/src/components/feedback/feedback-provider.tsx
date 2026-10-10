"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ui } from "@/content/ui";

type Kind = "info" | "error" | "success" | "confirm";

interface DialogState {
  kind: Kind;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface Feedback {
  showInfo: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  /** Resolves true when the person confirms, false on cancel or Escape. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<Feedback | null>(null);

const icons: Record<Kind, ReactNode> = {
  info: <Info aria-hidden className="size-6 text-green-600" />,
  error: <AlertTriangle aria-hidden className="size-6 text-danger-600" />,
  success: <CheckCircle2 aria-hidden className="size-6 text-green-600" />,
  confirm: <AlertTriangle aria-hidden className="size-6 text-text" />,
};

/** All form-level and system feedback goes through here (R4). No toasts. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  }, []);

  const api = useMemo<Feedback>(
    () => ({
      showInfo: (message, title = ui.infoTitle) => setDialog({ kind: "info", title, message }),
      showError: (message, title = ui.errorTitle) => setDialog({ kind: "error", title, message }),
      showSuccess: (message, title = ui.successTitle) =>
        setDialog({ kind: "success", title, message }),
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          resolver.current?.(false);
          resolver.current = resolve;
          setDialog({
            kind: "confirm",
            title: options.title ?? ui.confirmTitle,
            message: options.message,
            confirmLabel: options.confirmLabel ?? ui.confirm,
            cancelLabel: options.cancelLabel ?? ui.cancel,
            destructive: options.destructive,
          });
        }),
    }),
    [],
  );

  const isConfirm = dialog?.kind === "confirm";

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <Modal
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
        title={dialog?.title ?? ""}
        description={dialog?.message}
        hideClose={isConfirm}
        footer={
          dialog ? (
            isConfirm ? (
              <>
                <Button variant="ghost" onClick={() => settle(false)}>
                  {dialog.cancelLabel}
                </Button>
                <Button
                  variant={dialog.destructive ? "danger" : "primary"}
                  onClick={() => settle(true)}
                >
                  {dialog.confirmLabel}
                </Button>
              </>
            ) : (
              <Button onClick={() => settle(true)}>{ui.ok}</Button>
            )
          ) : null
        }
      >
        {dialog ? <div className="flex items-center gap-3">{icons[dialog.kind]}</div> : null}
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}
