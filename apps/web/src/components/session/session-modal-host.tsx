"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Lock,
  LogOut,
  MicOff,
  PhoneMissed,
  PhoneOff,
  Radio,
  RefreshCw,
  Smartphone,
  Unplug,
  Users,
  VideoOff,
  Volume2,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  pickCurrent,
  useSessionModals,
  type ModalIcon,
  type SessionAction,
} from "@/lib/session/modals";

const icons: Record<ModalIcon, LucideIcon> = {
  "wifi-off": WifiOff,
  refresh: RefreshCw,
  unplug: Unplug,
  alert: AlertTriangle,
  "mic-off": MicOff,
  "video-off": VideoOff,
  "phone-off": PhoneOff,
  "phone-missed": PhoneMissed,
  users: Users,
  "log-out": LogOut,
  lock: Lock,
  volume: Volume2,
  smartphone: Smartphone,
  external: ExternalLink,
  clock: Clock,
  radio: Radio,
};

const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
};

/**
 * The one place blocking call and room dialogs appear. Only one is open at a time: the most urgent wins and the
 * others wait their turn. It is an alertdialog, so a screen reader announces it, focus is trapped inside and goes back
 * to where it was on close, and there is always a way out.
 */
export function SessionModalHost() {
  const list = useSessionModals((s) => s.list);
  const dismiss = useSessionModals((s) => s.dismiss);
  const clear = useSessionModals((s) => s.clear);
  const current = pickCurrent(list);

  // A live counter such as "Trying for 0:12".
  const [now, setNow] = useState(() => Date.now());
  const counting = Boolean(current?.counter);
  useEffect(() => {
    if (!counting) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [counting, current?.id]);

  if (!current) return null;
  const Icon = icons[current.icon];
  const urgent =
    current.priority === "removed" ||
    current.priority === "ended" ||
    current.priority === "disconnected";
  // Escape runs the way out: the action marked secondary, or the last one.
  const exit =
    [...current.actions].reverse().find((a) => a.kind === "secondary") ??
    current.actions[current.actions.length - 1];

  const id = current.id;
  async function run(action: SessionAction) {
    await action.run?.();
    if (action.closes !== false) clear(id);
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (open) return;
        if (exit) void run(exit);
        else dismiss(id);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink-950/60" />
        <Dialog.Content
          role="alertdialog"
          data-session-modal={current.id}
          className="fixed left-1/2 top-1/2 z-[80] flex max-h-[90dvh] w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center overflow-y-auto rounded-card bg-surface p-6 text-center shadow-lift"
        >
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full",
              urgent ? "bg-danger-600/10 text-danger-600" : "bg-green-100 text-green-700",
            )}
          >
            <Icon aria-hidden className="size-7" />
          </span>
          <Dialog.Title className="mt-4 text-xl font-bold leading-tight text-text">
            {current.title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-base text-text-muted">
            {current.body}
          </Dialog.Description>
          {current.counter ? (
            <p className="tabular mt-3 text-sm font-semibold text-text" aria-live="off">
              {current.counter.label(
                mmss(Math.max(0, Math.floor((now - current.counter.since) / 1000))),
              )}
            </p>
          ) : null}
          {current.steps?.length ? (
            <ol className="mt-4 flex w-full list-decimal flex-col gap-1 pl-5 text-left text-sm text-text-muted">
              {current.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : null}
          <div className="mt-6 flex w-full flex-wrap justify-center gap-3">
            {current.actions.map((a) => (
              <Button
                key={a.id}
                variant={
                  a.kind === "danger" ? "danger" : a.kind === "secondary" ? "secondary" : "primary"
                }
                onClick={() => void run(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
