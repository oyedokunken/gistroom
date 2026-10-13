"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Mic, Phone, PhoneMissed, PhoneOff, Radio, Video, VolumeX } from "lucide-react";
import { LANGUAGE_LABELS, roomRingBlock, stackRings, type RingDto } from "@gistroom/shared";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { rings as copy } from "@/content/rings";
import { ApiClientError } from "@/lib/api";
import { openCall, openRoom, useCallWindow } from "@/lib/call-window/store";
import { callAction } from "@/lib/calls/api";
import { cn } from "@/lib/cn";
import { useLive } from "@/lib/live/live-session";
import { refreshRings, remainingMs, useRings } from "@/lib/rings/store";
import { roomApi } from "@/lib/rooms/api";
import { pushChip } from "@/lib/session/chips";
import { useNow } from "@/lib/session/use-held";
import { sounds } from "@/lib/sound/sounds";
import { useRealtimeStore } from "@/lib/realtime/store";
import { isPhone } from "@/lib/call-window/geometry";

/** How often the list is asked for. Fast without a live socket, slow as a safety net with one. */
const POLL_OFFLINE_MS = 3_000;
const POLL_ONLINE_MS = 30_000;
const POLL_RINGING_MS = 4_000;

/**
 * The ring window. Every incoming call and every room that rings you shows here, in one place and one look, top right
 * below the header (a heads-up card on a phone), whatever page you are on and wherever you left the call window. It never
 * takes focus, it is announced once, and it follows the server's list, so a reload shows it again with the right time left.
 */
export function RingHost() {
  const list = useRings((s) => s.rings);
  const closing = useRings((s) => s.closing);
  const quiet = useRings((s) => s.quiet);
  const dropClosing = useRings((s) => s.dropClosing);
  const connection = useRealtimeStore((s) => s.connection);
  const busy = useLive((s) => s.kind !== null && s.status !== "idle");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [told] = useState(() => new Set<string>());

  // The container is the first thing in the page, so it is early in the tab order.
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-ring-root", "");
    document.body.prepend(el);
    setTarget(el);
    return () => {
      el.remove();
    };
  }, []);

  // Ask the server on load, on focus, when the line returns, and on a timer.
  useEffect(() => {
    void refreshRings();
    const again = () => void refreshRings();
    const visible = () => document.visibilityState === "visible" && again();
    window.addEventListener("focus", again);
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", again);
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  const every =
    list.length > 0 ? POLL_RINGING_MS : connection === "online" ? POLL_ONLINE_MS : POLL_OFFLINE_MS;
  useEffect(() => {
    const id = window.setInterval(() => void refreshRings(), every);
    return () => window.clearInterval(id);
  }, [every]);

  // Already on a call or in a room: no ring on top of the conversation, only a quiet note that someone tried.
  useEffect(() => {
    if (!busy) return;
    for (const r of list) {
      if (told.has(r.id)) continue;
      told.add(r.id);
      pushChip({
        text:
          r.kind === "CALL"
            ? copy.busyCall(r.from.name)
            : copy.busyRoom(r.from.name, r.room?.title ?? ""),
        kind: "call",
      });
    }
  }, [busy, list, told]);

  const cards = useMemo(() => (busy || quiet ? [] : list), [busy, quiet, list]);
  const { shown, more } = stackRings(cards, 3);
  const ringing = shown.length > 0;

  // The window knows a ring is up: HIDDEN becomes RINGING, and it goes back when the last card goes.
  const first = shown[0];
  useEffect(() => {
    const w = useCallWindow.getState();
    if (first && w.state.mode === "HIDDEN") {
      w.dispatch({
        type: "ring",
        target: first.callId
          ? { kind: "call", id: first.callId }
          : { kind: "room", id: first.room?.slug ?? first.id },
      });
    } else if (!first && w.state.mode === "RINGING") {
      w.dispatch({ type: "dismissRing" });
    }
  }, [first?.id]);

  // The ringtone loops while a card is up and stops on every way out: answered, declined, ran out, left the page.
  useEffect(() => {
    if (!ringing) return;
    const m = sounds();
    m.startLoop("ringtone");
    setSoundBlocked(m.isBlocked());
    const id = window.setInterval(() => setSoundBlocked(m.isBlocked()), 1_000);
    return () => {
      window.clearInterval(id);
      m.stopLoop("ringtone");
      setSoundBlocked(false);
    };
  }, [ringing]);

  // Missed-call notes go after three seconds.
  useEffect(() => {
    if (closing.length === 0) return;
    const timers = closing.map((c) =>
      window.setTimeout(() => dropClosing(c.id), Math.max(0, c.until - Date.now())),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [closing, dropClosing]);

  const now = useNow(ringing);
  const phone =
    typeof window !== "undefined" && isPhone({ w: window.innerWidth, h: window.innerHeight });

  if (!target || (!ringing && closing.length === 0)) return null;
  const expandedRing = shown.find((r) => r.id === expanded) ?? null;

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="false"
        aria-label={copy.region}
        data-ring-window
        className={cn(
          "pointer-events-none fixed z-[66] flex flex-col gap-2",
          "inset-x-2 top-[calc(0.5rem+env(safe-area-inset-top))]",
          "md:inset-x-auto md:right-4 md:top-[4.5rem] md:w-[24rem]",
        )}
      >
        {/* Said once to a screen reader, and never again as the seconds tick. */}
        <div className="sr-only" aria-live="assertive">
          {shown.map((r) => (
            <p key={r.id}>
              {r.kind === "CALL"
                ? copy.announceCall(r.from.name, r.media === "VIDEO")
                : copy.announceRoom(r.from.name, r.room?.title ?? "")}
            </p>
          ))}
        </div>
        {closing.map((c) => (
          <div
            key={c.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 rounded-hero bg-ink-950 p-3 text-white shadow-lift"
          >
            <PhoneMissed aria-hidden className="size-5 shrink-0 text-yellow-400" />
            <Avatar name={c.person.name} src={c.person.avatarUrl} size={36} />
            <p className="min-w-0 flex-1 truncate font-semibold">{c.text}</p>
          </div>
        ))}
        {shown.map((r) => (
          <RingCard
            key={r.id}
            ring={r}
            now={now}
            compact={phone}
            onExpand={() => setExpanded(r.id)}
          />
        ))}
        {more > 0 ? (
          <p
            aria-label={copy.moreLabel(more)}
            className="pointer-events-auto self-end rounded-full bg-ink-950 px-3 py-1 text-sm font-semibold text-white shadow-lift"
          >
            {copy.more(more)}
          </p>
        ) : null}
        {soundBlocked ? (
          <button
            type="button"
            onClick={() => {
              sounds().unlock();
              setSoundBlocked(false);
            }}
            className="pointer-events-auto flex min-h-11 items-center justify-center gap-2 self-end rounded-full bg-yellow-400 px-4 text-sm font-semibold text-ink-950 shadow-lift"
          >
            <VolumeX aria-hidden className="size-4" />
            {copy.soundOff}
          </button>
        ) : null}
      </div>
      {phone && expandedRing ? (
        <RingCard
          ring={expandedRing}
          now={now}
          compact={false}
          full
          onClose={() => setExpanded(null)}
        />
      ) : null}
    </>,
    target,
  );
}

function RingCard({
  ring,
  now,
  compact,
  full,
  onExpand,
  onClose,
}: {
  ring: RingDto;
  now: number;
  compact: boolean;
  full?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}) {
  const { showError } = useFeedback();
  const [acting, setActing] = useState(false);
  const left = remainingMs(ring, now);
  const seconds = Math.ceil(left / 1000);
  const video = ring.media === "VIDEO";
  const room = ring.room;
  const block = room ? roomRingBlock(room) : null;

  const fail = useCallback(
    (e: unknown) => showError(e instanceof ApiClientError ? e.message : copy.failed),
    [showError],
  );

  async function answerCall(audioOnly: boolean) {
    if (!ring.callId) return;
    setActing(true);
    useRings.getState().markActed(ring.id);
    try {
      await callAction(ring.callId, "accept");
      sounds().stopLoop("ringtone");
      onClose?.();
      openCall(ring.callId, { audioOnly });
    } catch (e) {
      fail(e);
      void refreshRings();
    } finally {
      setActing(false);
    }
  }

  async function decline() {
    setActing(true);
    useRings.getState().markActed(ring.id);
    try {
      if (ring.callId) await callAction(ring.callId, "decline");
      else if (room) await roomApi.declineRing(room.slug);
    } catch {
      // Already over. Nothing to say.
    } finally {
      onClose?.();
      setActing(false);
    }
  }

  async function dontRing() {
    if (!room) return;
    useRings.getState().markActed(ring.id);
    await roomApi.declineRing(room.slug, true).catch(() => undefined);
    onClose?.();
  }

  function join() {
    if (!room || block) return;
    useRings.getState().markActed(ring.id);
    sounds().stopLoop("ringtone");
    onClose?.();
    openRoom(room.slug);
  }

  // The ring that has run out closes by itself. The server finishes it, and the next look confirms it.
  useEffect(() => {
    if (left > 0) return;
    // Past the ring time the server finishes the call as missed. The card does not wait for it.
    // A moment after the server's time, so it does not look at the clock a hair too early. Not cleared on unmount.
    const callId = ring.callId;
    if (callId) {
      window.setTimeout(() => void callAction(callId, "timeout").catch(() => undefined), 700);
    }
    useRings.getState().drop(ring.id);
    void refreshRings();
  }, [left, ring.id, ring.callId]);

  const circumference = 2 * Math.PI * 22;
  const total = Math.max(
    1,
    new Date(ring.expiresAt).getTime() - new Date(ring.startedAt).getTime(),
  );
  const fraction = Math.min(1, left / total);

  const avatar = (
    <span className="relative shrink-0">
      <Avatar
        name={ring.from.name}
        src={ring.from.avatarUrl}
        size={full ? 112 : compact ? 44 : 56}
      />
      <svg
        aria-hidden
        viewBox="0 0 48 48"
        className={cn(
          "pointer-events-none absolute -inset-1",
          full ? "size-[120px]" : compact ? "size-[52px]" : "size-16",
        )}
      >
        <circle cx="24" cy="24" r="22" fill="none" strokeWidth="3" className="stroke-white/15" />
        <circle
          cx="24"
          cy="24"
          r="22"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="origin-center -rotate-90 stroke-yellow-400"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
    </span>
  );

  const title = room ? copy.ringingYou(ring.from.name) : ring.from.name;
  const subtitle = room ? room.title : video ? copy.incomingVideo : copy.incomingAudio;

  const actions = (
    <div className={cn("flex flex-wrap items-center gap-2", full && "w-full flex-col")}>
      {ring.kind === "CALL" ? (
        <>
          <Action
            tone="primary"
            full={full}
            disabled={acting}
            onClick={() => void answerCall(false)}
            icon={
              video ? (
                <Video aria-hidden className="size-5" />
              ) : (
                <Phone aria-hidden className="size-5" />
              )
            }
            label={video ? copy.answerVideo : copy.answer}
          />
          {video ? (
            <Action
              tone="plain"
              full={full}
              disabled={acting}
              onClick={() => void answerCall(true)}
              icon={<Mic aria-hidden className="size-5" />}
              label={copy.answerAudio}
            />
          ) : null}
        </>
      ) : (
        <Action
          tone="primary"
          full={full}
          disabled={acting || Boolean(block)}
          onClick={join}
          icon={<Radio aria-hidden className="size-5" />}
          label={copy.join}
        />
      )}
      <Action
        tone="danger"
        full={full}
        disabled={acting}
        onClick={() => void decline()}
        icon={<PhoneOff aria-hidden className="size-5" />}
        label={copy.decline}
      />
    </div>
  );

  return (
    <div
      data-ring-card={ring.kind}
      data-ring-id={ring.id}
      className={cn(
        "pointer-events-auto text-white shadow-lift",
        full
          ? "fixed inset-0 z-[67] flex flex-col items-center justify-center gap-5 bg-ink-950 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center"
          : cn("rounded-hero bg-ink-950 p-3 ring-1 ring-white/10", video && !compact ? "p-4" : ""),
      )}
    >
      <div className={cn("flex gap-3", full ? "flex-col items-center" : "items-center")}>
        {avatar}
        <button
          type="button"
          onClick={onExpand}
          disabled={!onExpand}
          aria-label={onExpand ? copy.expand : undefined}
          className={cn(
            "min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-yellow-400",
            full && "text-center",
            !onExpand && "cursor-default",
          )}
        >
          <span className={cn("block truncate font-bold", full ? "text-2xl" : "text-lg")}>
            {title}
          </span>
          <span className="block truncate text-sm text-white/80">{subtitle}</span>
          <span className="tabular block text-xs text-white/60" aria-hidden>
            {seconds}s
          </span>
        </button>
      </div>

      {room ? (
        <div className={cn("mt-2 flex flex-col gap-2", full && "items-center")}>
          <div className="flex flex-wrap items-center gap-1.5">
            {room.topicName ? <Badge>{room.topicName}</Badge> : null}
            <Badge>{LANGUAGE_LABELS[room.language]}</Badge>
            <Badge>{room.media === "VIDEO" ? copy.videoTag : copy.audioTag}</Badge>
            {room.visibility === "PRIVATE" || room.locked ? (
              <Badge>
                <Lock aria-hidden className="mr-1 size-3" />
                {room.locked ? copy.lockedBadge : copy.privateBadge}
              </Badge>
            ) : null}
          </div>
          <p className="flex items-center gap-2 text-sm text-white/80">
            <span className="flex -space-x-2">
              {room.avatars.map((a, i) => (
                <Avatar key={`${a.name}${i}`} name={a.name} src={a.avatarUrl} size={24} />
              ))}
            </span>
            <span className="tabular">{copy.inside(room.joined)}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{copy.host(room.hostName)}</span>
          </p>
          {block ? (
            <p role="status" className="text-sm font-semibold text-yellow-400">
              {block === "ENDED" ? copy.ended : block === "LOCKED" ? copy.locked : copy.full}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={cn("mt-3", full && "w-full")}>{actions}</div>
      {room ? (
        <button
          type="button"
          onClick={() => void dontRing()}
          className="mt-2 min-h-11 text-sm font-semibold text-white/80 underline-offset-4 hover:underline"
        >
          {copy.dontRing}
        </button>
      ) : null}
    </div>
  );
}

function Action({
  label,
  icon,
  onClick,
  disabled,
  tone,
  full,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: "primary" | "plain" | "danger";
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400 disabled:opacity-50",
        full && "w-full min-h-14 text-base",
        tone === "primary" && "bg-green-600 text-white hover:bg-green-700",
        tone === "plain" && "bg-white/15 text-white hover:bg-white/25",
        tone === "danger" && "bg-danger-600 text-white",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
