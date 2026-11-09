"use client";

import { MonitorOff, MonitorUp, ScreenShare, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { presentCopy as copy } from "@/content/present";
import { cn } from "@/lib/cn";
import type { Presenter } from "@/lib/live/use-presenter";

/** The states in which a person has no business with the control at all, so it is not drawn. */
const HIDDEN: ReadonlySet<string> = new Set([
  "ENDED",
  "NOT_IN",
  "REMOVED",
  "BANNED",
  "NOT_STARTED",
]);

/**
 * "Present now" and "Stop presenting". The label is always visible next to the icon so the control is clear. While
 * someone else presents it stays, and pressing it explains and offers a turn instead of doing nothing.
 */
export function PresentButton({
  p,
  disabled,
  size = "md",
}: {
  p: Presenter;
  disabled?: boolean;
  size?: "md" | "lg";
}) {
  if (!p.dto || (p.rules.denied && HIDDEN.has(p.rules.denied))) return null;
  const busy = !p.sharing && p.rules.denied === "BUSY";
  const label = p.sharing ? copy.control.stop : busy ? copy.control.busy : copy.control.present;
  const Icon = p.sharing ? MonitorOff : busy ? ScreenShare : MonitorUp;
  return (
    <button
      type="button"
      aria-pressed={p.sharing}
      aria-busy={p.starting || undefined}
      title={label}
      disabled={disabled || p.starting}
      onClick={() => void (p.sharing ? p.stop() : p.start())}
      className={cn(
        "flex items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50",
        size === "lg" ? "min-h-16" : "min-h-14",
        p.sharing ? "bg-yellow-400 text-ink-950" : "bg-white/15 text-white hover:bg-white/25",
      )}
    >
      <Icon aria-hidden className="size-6 shrink-0" />
      {p.starting ? copy.control.starting : label}
    </button>
  );
}

/** A clear, persistent state while you present: what is shared, that camera and mic are separate, and how to stop. */
export function PresenterBanner({ p }: { p: Presenter }) {
  if (!p.sharing) return null;
  return (
    <div
      role="status"
      className="mx-3 flex w-[calc(100%-1.5rem)] max-w-3xl flex-wrap items-center justify-between gap-3 rounded-card bg-yellow-400 px-4 py-3 text-ink-950"
    >
      <span className="flex min-w-0 items-center gap-3">
        <MonitorUp aria-hidden className="size-6 shrink-0" />
        <span className="min-w-0">
          <span className="block font-bold">{copy.live.you}</span>
          <span className="block text-sm">{copy.live.youBody}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={() => void p.stop()}
        className="min-h-11 shrink-0 rounded-full bg-ink-950 px-5 text-sm font-semibold text-white"
      >
        {copy.control.stop}
      </button>
    </div>
  );
}

/**
 * Inline words under the controls: unsupported browser, a blocked picker, a request that was answered. They stay until
 * dismissed (no timer, no toast) and are announced politely.
 */
export function PresentStatus({ p }: { p: Presenter }) {
  const waiting = p.waitingFor;
  if (!p.notice && !waiting) return null;
  return (
    <div className="flex w-full flex-col items-center gap-2 px-3" aria-live="polite">
      {waiting ? (
        <p
          role="status"
          className="flex flex-wrap items-center justify-center gap-3 rounded-card bg-white/10 px-4 py-2 text-sm text-white"
        >
          <span>
            {copy.request.waiting(waiting)}
            {p.secondsLeft !== null ? <span className="tabular"> {p.secondsLeft}s</span> : null}
          </span>
          <button
            type="button"
            onClick={() => void p.cancelAsk()}
            className="min-h-11 rounded-full bg-white/15 px-4 font-semibold hover:bg-white/25"
          >
            {copy.request.cancelAsk}
          </button>
        </p>
      ) : null}
      {p.notice ? (
        <p
          role={p.notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex max-w-xl items-start gap-2 rounded-card px-4 py-2 text-sm",
            p.notice.tone === "error" ? "bg-danger-600 text-white" : "bg-white/10 text-white",
          )}
        >
          <span className="min-w-0 pt-2">{p.notice.text}</span>
          <button
            type="button"
            aria-label={copy.notice.close}
            onClick={p.dismissNotice}
            className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
          >
            <X aria-hidden className="size-5" />
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** The dialogs: before you present, someone else is presenting, a request for your turn, and your turn after a handoff. */
export function PresentDialogs({ p, inRoom }: { p: Presenter; inRoom: boolean }) {
  const [remember, setRemember] = useState(false);
  const name = p.presenterName ?? "";
  const reduced = p.prepare?.reason ?? null;
  const requester = p.dto?.requester?.name ?? "";
  const requestOpen = p.rules.canAnswerRequest && Boolean(p.dto?.requester);
  const secs = p.secondsLeft;
  return (
    <>
      <Modal
        open={p.prepare !== null}
        onOpenChange={(open) => {
          if (!open) p.prepare?.resolve(false, false);
        }}
        icon={MonitorUp}
        tone="info"
        title={reduced ? copy.prepare.reducedTitle : copy.prepare.title}
        description={
          reduced === "data-saver"
            ? copy.prepare.reducedDataSaver
            : reduced === "weak"
              ? copy.prepare.reducedWeak
              : inRoom
                ? copy.prepare.bodyRoom
                : copy.prepare.body
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => p.prepare?.resolve(false, false)}>
              {copy.prepare.cancel}
            </Button>
            <Button onClick={() => p.prepare?.resolve(true, remember)}>
              {reduced ? copy.prepare.reducedChoose : copy.prepare.choose}
            </Button>
          </>
        }
      >
        {reduced ? (
          <p className="text-sm text-text-muted">
            {inRoom ? copy.prepare.bodyRoom : copy.prepare.body}
          </p>
        ) : (
          <Checkbox
            label={copy.prepare.remember}
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
        )}
      </Modal>

      <Modal
        open={p.busyOpen && !p.sharing}
        onOpenChange={p.setBusyOpen}
        icon={ScreenShare}
        tone="info"
        title={copy.busy.title(name)}
        description={p.rules.canTakeOver ? copy.busy.bodyMod : copy.busy.body}
        footer={
          <>
            <Button variant="secondary" onClick={() => p.setBusyOpen(false)}>
              {copy.busy.cancel}
            </Button>
            {p.rules.canAsk ? <Button onClick={() => void p.ask()}>{copy.busy.ask}</Button> : null}
            {p.rules.canTakeOver ? (
              <Button variant="accent" onClick={() => void p.takeOver()}>
                {copy.busy.takeOver}
              </Button>
            ) : null}
          </>
        }
      />

      <Modal
        open={requestOpen}
        onOpenChange={(open) => {
          if (!open) void p.answer(false);
        }}
        icon={ScreenShare}
        tone="info"
        title={copy.request.title(requester)}
        description={`${copy.request.body}${secs !== null ? ` ${secs}s` : ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => void p.answer(false)}>
              {copy.request.decline}
            </Button>
            <Button onClick={() => void p.answer(true)}>{copy.request.allow}</Button>
          </>
        }
      />

      <Modal
        open={p.handoffToMe}
        onOpenChange={(open) => {
          if (!open) p.dismissHandoff();
        }}
        icon={MonitorUp}
        tone="success"
        title={copy.handoff.title}
        description={`${copy.handoff.body}${secs !== null ? ` ${secs}s` : ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={p.dismissHandoff}>
              {copy.handoff.later}
            </Button>
            <Button
              onClick={() => {
                p.dismissHandoff();
                void p.start();
              }}
            >
              {copy.handoff.present}
            </Button>
          </>
        }
      />

      <Modal
        open={p.forceStopOpen}
        onOpenChange={p.setForceStopOpen}
        icon={MonitorOff}
        tone="error"
        title={copy.live.stopForEveryoneTitle(name)}
        description={copy.live.stopForEveryoneBody}
        footer={
          <>
            <Button variant="secondary" onClick={() => p.setForceStopOpen(false)}>
              {copy.busy.cancel}
            </Button>
            <Button variant="danger" onClick={() => void p.forceStop()}>
              {copy.live.stopForEveryone}
            </Button>
          </>
        }
      />
    </>
  );
}
