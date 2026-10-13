"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCcw,
  SmilePlus,
  WifiOff,
} from "lucide-react";
import { REACTIONS, durationSec, isFinished, type CallDto, type CallJoin } from "@gistroom/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { callCopy as copy } from "@/content/calls";
import { ApiClientError } from "@/lib/api";
import { callAction, callHeartbeat, fetchCall } from "@/lib/calls/api";
import { session as sessionCopy } from "@/content/session";
import { showCallOutcome } from "@/lib/live/call-outcomes";
import { showSessionModal } from "@/lib/session/modals";
import { sounds } from "@/lib/sound/sounds";
import { startRingtone, stopRingtone } from "@/lib/calls/ringtone";
import { useCallStore } from "@/lib/calls/store";
import { useLiveKit } from "@/lib/calls/use-livekit";
import { onLiveEvent } from "@/lib/live/live-session";
import { formatDuration } from "@/lib/chat/voice";
import { cn } from "@/lib/cn";

function useElapsed(answeredAt: string | null, running: boolean): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!answeredAt || !running) return;
    const start = new Date(answeredAt).getTime();
    const tick = () => setMs(Math.max(0, Date.now() - start));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [answeredAt, running]);
  return ms;
}

export function CallScreen({
  callId,
  autoAnswer,
  dataSaver,
}: {
  callId: string;
  autoAnswer: boolean;
  dataSaver: boolean;
}) {
  const queryClient = useQueryClient();
  const { showError, confirm } = useFeedback();
  const query = useQuery({ queryKey: ["call", callId], queryFn: () => fetchCall(callId) });
  const live = useCallStore((s) => s.updates[callId]);
  const [override, setOverride] = useState<CallJoin | null>(null);
  const [acting, setActing] = useState(false);
  const answered = useRef(false);

  const join = override ?? query.data ?? null;
  const call: CallDto | null =
    live && join && new Date(live.endedAt ?? 0) >= new Date(join.call.endedAt ?? 0)
      ? live
      : (join?.call ?? null);
  const status = call?.status ?? "RINGING";
  const finished = call ? isFinished(call.status) : false;
  const incoming = call?.direction === "INCOMING";
  const ringingIn = incoming && status === "RINGING";

  const startWithVideo = call?.media === "VIDEO" && !dataSaver;
  const reduced = useReducedMotion();
  const [floating, setFloating] = useState<{ id: string; emoji: string; left: number }[]>([]);
  const float = (emoji: string) =>
    setFloating((list) => [
      ...list.slice(-24),
      { id: crypto.randomUUID(), emoji, left: 12 + Math.round(Math.random() * 70) },
    ]);
  const lk = useLiveKit({
    callId,
    title: call?.peer.name ?? copy.connecting,
    hangUp: async () => {
      await callAction(callId, "end").catch(() => undefined);
    },
    heartbeat: () => void callHeartbeat(callId),
    beacon: () => undefined,
    url: finished ? null : (join?.url ?? null),
    token: finished ? null : (join?.token ?? null),
    startWithVideo,
    lowData: dataSaver,
  });
  // The other person's reactions arrive over the call itself.
  useEffect(
    () =>
      onLiveEvent((e) => {
        if (e.type === "reaction" && e.identity !== null) float(e.emoji);
      }),
    // float only uses state setters
    [],
  );
  const elapsed = useElapsed(call?.answeredAt ?? null, status === "ACTIVE");
  const router = useRouter();
  const nav = useMemo(() => ({ push: (path: string) => router.push(path) }), [router]);

  // The call screen that is open, so its ending is told even when there is no live connection (it rang out).
  useEffect(() => {
    useCallStore.getState().setScreen(callId);
    return () => useCallStore.getState().setScreen(null);
  }, [callId]);

  // Incoming rings on this screen until answered. The caller hears a softer ringback while it rings.
  useEffect(() => {
    if (!ringingIn) return;
    startRingtone();
    return () => stopRingtone();
  }, [ringingIn]);
  const ringingOut = call?.direction === "OUTGOING" && status === "RINGING";
  useEffect(() => {
    if (!ringingOut) return;
    sounds().startLoop("ringback");
    return () => sounds().stopLoop("ringback");
  }, [ringingOut]);

  // Tones for the moments of a call: picked up, and over.
  const wasActive = useRef(false);
  useEffect(() => {
    if (status === "ACTIVE" && !wasActive.current) {
      wasActive.current = true;
      sounds().play("callConnected");
    }
    if (finished && wasActive.current) {
      wasActive.current = false;
      sounds().play("callEnded");
    }
  }, [status, finished]);

  // How the call ended is said once, in a dialog, in plain words.
  useEffect(() => {
    if (call && finished) showCallOutcome(call, nav);
  }, [call, finished, nav]);

  // The person being called has no alerts on and has not been seen lately. Say so, and let the caller choose.
  const unreachable = ringingOut && call?.peerReachable === false;
  useEffect(() => {
    if (!unreachable || !call) return;
    showSessionModal({
      id: `call-unavailable:${call.id}`,
      priority: "info",
      icon: "phone-missed",
      title: sessionCopy.call.unavailableTitle(call.peer.name),
      body: sessionCopy.call.unavailableBody,
      actions: [
        { id: "keep", label: sessionCopy.call.keepCalling },
        {
          id: "message",
          label: sessionCopy.modal.message,
          kind: "secondary",
          run: () => {
            if (call.conversationId) router.push(`/app/chats/${call.conversationId}`);
          },
        },
      ],
    });
  }, [unreachable, call, router]);

  // Close the connection the moment the call is over.
  useEffect(() => {
    if (finished) lk.leave();
  }, [finished]);

  // Ring ran out: tell the server, then show how it ended.
  useEffect(() => {
    if (!call || status !== "RINGING") return;
    const wait = Math.max(0, new Date(call.ringExpiresAt).getTime() - Date.now());
    const id = window.setTimeout(async () => {
      try {
        setOverride(await callAction(callId, "timeout"));
      } catch {
        void query.refetch();
      }
    }, wait + 500);
    return () => window.clearTimeout(id);
  }, [call, status, callId, query]);

  async function run(action: "accept" | "decline" | "cancel" | "end") {
    setActing(true);
    try {
      const next = await callAction(callId, action);
      setOverride(next);
      void queryClient.invalidateQueries({ queryKey: ["calls"] });
    } catch (e) {
      showError(e instanceof ApiClientError ? e.message : copy.loadError);
      void query.refetch();
    } finally {
      setActing(false);
    }
  }

  // Opened from a push notification Answer button: answer straight away.
  useEffect(() => {
    if (!autoAnswer || answered.current || !call) return;
    if (call.direction === "INCOMING" && call.status === "RINGING") {
      answered.current = true;
      void run("accept");
    }
  }, [autoAnswer, call]);

  async function toggleCamera() {
    const turningOn = !lk.state.camOn;
    const result = await lk.setCamera(turningOn);
    if (turningOn && result === "blocked") {
      showError(copy.cameraBlocked, copy.cameraBlockedTitle);
    }
  }

  async function hangUp() {
    if (status === "RINGING") {
      await run(incoming ? "decline" : "cancel");
      return;
    }
    const ok = await confirm({
      title: copy.end,
      message: copy.endedBody(formatDuration(elapsed)),
      confirmLabel: copy.end,
      destructive: true,
    });
    if (ok) await run("end");
  }

  const heading = useMemo(() => {
    if (!call) return "";
    if (finished) {
      return call.status === "ENDED"
        ? copy.endedTitle
        : call.status === "MISSED"
          ? copy.missedTitle
          : call.status === "DECLINED"
            ? copy.declinedTitle
            : call.status === "BUSY"
              ? copy.busyTitle
              : copy.cancelledTitle;
    }
    if (status === "ACTIVE") return lk.state.connected ? formatDuration(elapsed) : copy.connecting;
    return incoming ? copy.incomingTitle(call.peer.name) : copy.calling(call.peer.name);
  }, [call, finished, status, incoming, lk.state.connected, elapsed]);

  if (query.isError && !join) {
    return (
      <Shell>
        <p className="text-lg">{copy.loadError}</p>
        <Button variant="accent" onClick={() => void query.refetch()}>
          {copy.logs.retry}
        </Button>
      </Shell>
    );
  }
  if (!call) {
    return (
      <Shell>
        <p className="text-lg text-white/80">{copy.connecting}</p>
      </Shell>
    );
  }

  const peer = call.peer;
  const showVideo = lk.state.remoteCam && status === "ACTIVE";
  const duration = formatDuration(
    durationSec(
      call.answeredAt ? new Date(call.answeredAt) : null,
      call.endedAt ? new Date(call.endedAt) : null,
    ) * 1000,
  );

  return (
    <Shell>
      <div ref={lk.audioHost} className="sr-only" aria-hidden />
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live camera has no caption track */}
        <video
          ref={lk.remoteVideo}
          autoPlay
          playsInline
          aria-label={copy.remoteCamera(peer.name)}
          className={cn(
            "absolute inset-0 size-full rounded-hero bg-ink-950 object-cover transition-opacity duration-300",
            showVideo ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
        <div
          className={cn(
            "relative z-10 flex flex-col items-center gap-4 text-center transition-opacity duration-300",
            showVideo && "pointer-events-none opacity-0",
          )}
        >
          <span className="relative">
            <Avatar name={peer.name} src={peer.avatarUrl} size={144} />
            {status === "RINGING" ? (
              <span
                aria-hidden
                className="absolute -inset-3 rounded-full border-4 border-yellow-400 motion-safe:animate-pulse"
              />
            ) : null}
          </span>
          <h1 className="text-3xl font-bold tracking-tight">{peer.name}</h1>
          <p
            role="status"
            aria-live="polite"
            className={cn("text-xl text-white/85", status === "ACTIVE" && "tabular")}
          >
            {heading}
          </p>
          {finished && call.status === "ENDED" ? (
            <p className="text-white/80">{copy.endedBody(duration)}</p>
          ) : null}
          {finished && call.status === "MISSED" ? (
            <p className="max-w-xs text-white/80">{copy.missedBody(peer.name)}</p>
          ) : null}
          {finished && call.status === "DECLINED" ? (
            <p className="max-w-xs text-white/80">{copy.declinedBody(peer.name)}</p>
          ) : null}
          {dataSaver && call.media === "VIDEO" && !finished ? (
            <p className="max-w-xs text-sm text-white/70">{copy.dataSaverNote}</p>
          ) : null}
        </div>

        <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          <AnimatePresence>
            {floating.map((r) => (
              <motion.span
                key={r.id}
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.7 }}
                animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 1, 0], y: -220, scale: 1.2 }}
                transition={{ duration: reduced ? 1.6 : 2.4, ease: "easeOut" }}
                onAnimationComplete={() => setFloating((l) => l.filter((x) => x.id !== r.id))}
                className="absolute bottom-6 text-4xl"
                style={{ left: `${r.left}%` }}
              >
                {r.emoji}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <video
          ref={lk.localVideo}
          autoPlay
          muted
          playsInline
          aria-label={copy.you}
          className={cn(
            "absolute bottom-2 right-2 z-20 h-32 w-24 rounded-card bg-ink-700 object-cover shadow-lift md:h-44 md:w-32",
            lk.state.camOn ? "block" : "hidden",
          )}
        />
      </div>

      {lk.state.reconnecting || (status === "ACTIVE" && lk.state.failed) ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm"
        >
          <WifiOff aria-hidden className="size-4" />
          {copy.connectionLost}
        </p>
      ) : null}
      {lk.state.poorFor10s && lk.state.camOn ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-center gap-3 rounded-card bg-yellow-400 px-4 py-2 text-sm font-semibold text-ink-950"
        >
          {copy.poorNetwork}
          <button
            type="button"
            onClick={() => void lk.setCamera(false)}
            className="min-h-11 rounded-full bg-ink-950 px-4 text-white"
          >
            {copy.switchToAudio}
          </button>
        </div>
      ) : null}
      {lk.state.micBlocked ? (
        <p role="alert" className="max-w-md text-center text-sm text-yellow-400">
          {copy.micBlocked}
        </p>
      ) : null}

      {finished ? (
        <div className="flex flex-wrap justify-center gap-3">
          {call.conversationId ? (
            <Link
              href={`/app/chats/${call.conversationId}`}
              className={buttonStyles("accent", "min-h-12 px-6")}
            >
              {copy.backToChat}
            </Link>
          ) : null}
          <Link
            href="/app/calls"
            className="inline-flex min-h-12 items-center rounded-full border-2 border-white/70 px-6 font-semibold text-white hover:bg-white/10"
          >
            {copy.backToCalls}
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {ringingIn ? (
            <>
              <RoundButton
                label={copy.decline}
                tone="danger"
                disabled={acting}
                onClick={() => void run("decline")}
              >
                <PhoneOff aria-hidden className="size-6" />
              </RoundButton>
              <RoundButton
                label={copy.answer}
                tone="green"
                disabled={acting}
                onClick={() => void run("accept")}
              >
                <Mic aria-hidden className="size-6" />
              </RoundButton>
            </>
          ) : (
            <>
              <RoundButton
                label={lk.state.micOn ? copy.mute : copy.unmute}
                pressed={!lk.state.micOn}
                onClick={() => void lk.toggleMic()}
                disabled={!lk.state.connected}
              >
                {lk.state.micOn ? (
                  <Mic aria-hidden className="size-6" />
                ) : (
                  <MicOff aria-hidden className="size-6" />
                )}
              </RoundButton>
              <RoundButton
                label={lk.state.camOn ? copy.cameraOff : copy.cameraOn}
                pressed={lk.state.camOn}
                onClick={() => void toggleCamera()}
                disabled={!lk.state.connected}
              >
                {lk.state.camOn ? (
                  <Camera aria-hidden className="size-6" />
                ) : (
                  <CameraOff aria-hidden className="size-6" />
                )}
              </RoundButton>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={copy.reactions}
                    title={copy.reactions}
                    disabled={!lk.state.connected}
                    className="flex size-16 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                  >
                    <SmilePlus aria-hidden className="size-6" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" keepOpenOnFocusOutside className="p-2">
                  <div
                    role="group"
                    aria-label={copy.reactions}
                    className="grid grid-cols-5 gap-1 text-text"
                  >
                    {REACTIONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        aria-label={r.label}
                        onClick={() => {
                          float(r.emoji);
                          void lk.sendReaction(r.emoji);
                        }}
                        className="flex size-11 items-center justify-center rounded-full text-2xl hover:bg-green-100"
                      >
                        {r.emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {lk.state.camOn ? (
                <RoundButton label={copy.flip} onClick={() => void lk.flipCamera()}>
                  <RefreshCcw aria-hidden className="size-6" />
                </RoundButton>
              ) : null}
              <RoundButton
                label={status === "RINGING" ? copy.cancel : copy.end}
                tone="danger"
                disabled={acting}
                onClick={() => void hangUp()}
              >
                <PhoneOff aria-hidden className="size-6" />
              </RoundButton>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center gap-5 bg-ink-950 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white md:p-8">
      {children}
    </div>
  );
}

function RoundButton({
  label,
  children,
  tone = "plain",
  pressed,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "plain" | "danger" | "green";
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-16 items-center justify-center rounded-full transition-colors disabled:opacity-50",
        tone === "danger" && "bg-danger-600 text-white",
        tone === "green" && "bg-green-600 text-white",
        tone === "plain" &&
          (pressed ? "bg-yellow-400 text-ink-950" : "bg-white/15 text-white hover:bg-white/25"),
      )}
    >
      {children}
    </button>
  );
}
