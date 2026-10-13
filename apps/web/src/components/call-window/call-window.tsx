"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Expand, Maximize2, Mic, MicOff, Minimize2, PhoneOff, Shrink, X } from "lucide-react";
import { CallScreen } from "@/components/call/call-screen";
import { RoomScreen } from "@/components/room/room-screen";
import { callWindow as copy } from "@/content/call-window";
import { session as sessionCopy } from "@/content/session";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/chat/voice";
import {
  clampRect,
  defaultRect,
  dragRect,
  isPhone,
  resizeRect,
  snapRect,
  type Handle,
  type Rect,
} from "@/lib/call-window/geometry";
import { hasScreen, type WindowMode } from "@/lib/call-window/machine";
import { closeWindow, dispatchWindow, useCallWindow } from "@/lib/call-window/store";
import { live, useLive } from "@/lib/live/live-session";
import { useNow } from "@/lib/session/use-held";
import { EmbedProvider } from "./embed";

export interface WindowUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  dataSaver: boolean;
}

const HANDLES: { id: Handle; className: string; cursor: string }[] = [
  { id: "n", className: "inset-x-3 -top-1 h-2", cursor: "ns-resize" },
  { id: "s", className: "inset-x-3 -bottom-1 h-2", cursor: "ns-resize" },
  { id: "e", className: "inset-y-3 -right-1 w-2", cursor: "ew-resize" },
  { id: "w", className: "inset-y-3 -left-1 w-2", cursor: "ew-resize" },
  { id: "ne", className: "-right-1 -top-1 size-4", cursor: "nesw-resize" },
  { id: "nw", className: "-left-1 -top-1 size-4", cursor: "nwse-resize" },
  { id: "se", className: "-bottom-1 -right-1 size-4", cursor: "nwse-resize" },
  { id: "sw", className: "-bottom-1 -left-1 size-4", cursor: "nesw-resize" },
];

/** The look of the screen scaled into a thumbnail, so a video call can float as a small bubble on a phone. */
const BUBBLE = { w: 112, h: 176, innerW: 360, innerH: 566 };

function useViewport() {
  const [vp, setVp] = useState(() =>
    typeof window === "undefined"
      ? { w: 1280, h: 720 }
      : { w: window.innerWidth, h: window.innerHeight },
  );
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return vp;
}

/**
 * The call and room window. One per tab, mounted once in the app shell, so a call or room floats over whatever page
 * you are on instead of taking the screen. It shows the same call and room screens as before. Expanded it drags and
 * resizes, minimized it is a bar, full screen it takes everything, and it never blocks the page behind it.
 */
export function CallWindow({ user }: { user: WindowUser }) {
  const { state, rect, setRect, setOwner } = useCallWindow();
  const s = useLive();
  const vp = useViewport();
  const phone = isPhone(vp);
  const ours = useRef(false);
  const [live2, setLive2] = useState<Rect | null>(null);
  const [announce, setAnnounce] = useState("");
  const active = s.kind !== null && s.status !== "idle" && s.startedAt !== null;
  const now = useNow(active && hasScreen(state));

  useEffect(() => setOwner(user.id), [user.id, setOwner]);

  // The saved place came from another screen size: keep it on this one.
  const current = useMemo(() => clampRect(live2 ?? rect ?? defaultRect(vp), vp), [live2, rect, vp]);

  const mode: WindowMode = state.mode;
  const full = mode === "FULLSCREEN" || (mode === "EXPANDED" && phone);
  const target = state.target;

  // Say what changed, for screen readers, without moving focus.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (mode === "MINIMIZED") setAnnounce(copy.minimize);
    else if (mode === "FULLSCREEN") setAnnounce(copy.fullscreen);
    else if (mode === "EXPANDED") setAnnounce(copy.restore);
    else setAnnounce("");
  }, [mode]);

  // The Fullscreen API where the browser has it. Elsewhere (an iPhone) the CSS full screen layout is the fallback.
  useEffect(() => {
    if (typeof document === "undefined") return;
    // The whole page goes full screen, not just the window, so dialogs and notices still show above it.
    if (
      mode === "FULLSCREEN" &&
      !phone &&
      document.fullscreenEnabled &&
      !document.fullscreenElement
    ) {
      ours.current = true;
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
    // Only leave a full screen this window started, never a video the person made full screen themselves.
    if (mode !== "FULLSCREEN" && ours.current && document.fullscreenElement) {
      ours.current = false;
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, [mode, phone]);
  useEffect(() => {
    const onChange = () => {
      // Escape took the browser out of full screen: the window follows.
      if (!document.fullscreenElement && useCallWindow.getState().state.mode === "FULLSCREEN") {
        if (!isPhone({ w: window.innerWidth, h: window.innerHeight })) {
          dispatchWindow({ type: "exitFullscreen" });
        }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  // Escape also leaves the CSS full screen, unless a dialog is open or the person is typing.
  useEffect(() => {
    if (mode !== "FULLSCREEN") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]'))
        return;
      dispatchWindow({ type: "exitFullscreen" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  // ----- Dragging and resizing -----
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (full || mode !== "EXPANDED" || e.button > 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      const start = current;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      let last = start;
      const move = (ev: PointerEvent) => {
        last = dragRect(start, ev.clientX - x0, ev.clientY - y0, vp);
        setLive2(last);
      };
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        const done = snapRect(last, vp);
        setLive2(null);
        setRect(done);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    },
    [current, full, mode, vp, setRect],
  );

  const startResize = useCallback(
    (handle: Handle) => (e: React.PointerEvent) => {
      if (e.button > 0) return;
      e.stopPropagation();
      const start = current;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      // A call keeps a 16 by 9 picture, a room keeps whatever shape it is pulled to.
      const aspect = target?.kind === "call" ? 16 / 9 : undefined;
      let last = start;
      const move = (ev: PointerEvent) => {
        last = resizeRect(start, handle, ev.clientX - x0, ev.clientY - y0, vp, aspect);
        setLive2(last);
      };
      const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        setLive2(null);
        setRect(last);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    },
    [current, target, vp, setRect],
  );

  // Keyboard: arrow keys move the focused header, with shift they resize.
  const onHeaderKey = (e: React.KeyboardEvent) => {
    if (full || mode !== "EXPANDED") return;
    const step = e.altKey ? 4 : 24;
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    setRect(e.shiftKey ? resizeRect(current, "se", dx, dy, vp) : dragRect(current, dx, dy, vp));
  };

  if (!target || !hasScreen(state)) return null;

  const title = s.title || (target.kind === "call" ? copy.callTitle : "");
  const elapsed = active ? formatDuration(now - (s.startedAt ?? now)) : "";
  const videoCall = target.kind === "call" && (s.remoteCam || s.camOn);
  const minimized = mode === "MINIMIZED";
  const bubble = minimized && phone && videoCall;

  const wrapperStyle: React.CSSProperties = minimized
    ? bubble
      ? { width: BUBBLE.w, height: BUBBLE.h, right: 12, top: 72 }
      : {}
    : full
      ? {}
      : {
          width: current.w,
          height: current.h,
          transform: `translate(${current.x}px, ${current.y}px)`,
        };

  const body = (
    <EmbedProvider value>
      {target.kind === "call" ? (
        <CallScreen
          callId={target.id}
          autoAnswer={Boolean(target.autoAnswer)}
          dataSaver={user.dataSaver}
        />
      ) : (
        <RoomScreen
          slug={target.id}
          invite={target.invite ?? null}
          meId={user.id}
          meName={user.name}
          meAvatar={user.avatarUrl}
          dataSaver={user.dataSaver}
        />
      )}
    </EmbedProvider>
  );

  const barLabel = target.kind === "call" ? copy.tapToReturnCall : copy.tapToReturnRoom;

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      <div
        role="dialog"
        aria-modal="false"
        aria-label={copy.label(title)}
        data-call-window={mode}
        data-testid="call-window"
        className={cn(
          "fixed z-[60] flex flex-col overflow-visible text-white",
          // Expanded floats at its own place. Full screen covers the page. A bar sits clear of the tab bar.
          !minimized &&
            !full &&
            "left-0 top-0 rounded-3xl bg-ink-950 shadow-lift ring-1 ring-white/10",
          full && "inset-0 bg-ink-950",
          minimized && !bubble && "pointer-events-none",
          bubble && "overflow-hidden rounded-2xl bg-ink-950 shadow-lift ring-1 ring-white/20",
        )}
        style={wrapperStyle}
      >
        {/* Header: drag handle, title, timer and the four window buttons. */}
        {!minimized ? (
          <div
            data-call-window-header
            onPointerDown={startDrag}
            onDoubleClick={() => dispatchWindow({ type: "toggleFullscreen" })}
            onKeyDown={onHeaderKey}
            role="toolbar"
            aria-label={copy.move}
            tabIndex={0}
            className={cn(
              "flex h-11 shrink-0 select-none items-center gap-2 border-b border-white/10 px-3",
              full
                ? "pt-[env(safe-area-inset-top)]"
                : "cursor-grab touch-none rounded-t-3xl active:cursor-grabbing",
            )}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {title}
              {elapsed ? (
                <span className="tabular ml-2 font-normal text-white/70">{elapsed}</span>
              ) : null}
            </span>
            <HeaderButton
              label={copy.minimize}
              onClick={() => dispatchWindow({ type: "minimize" })}
              icon={<Minimize2 aria-hidden className="size-4" />}
            />
            {!phone ? (
              <HeaderButton
                label={mode === "FULLSCREEN" ? copy.exitFullscreen : copy.fullscreen}
                onClick={() => dispatchWindow({ type: "toggleFullscreen" })}
                icon={
                  mode === "FULLSCREEN" ? (
                    <Shrink aria-hidden className="size-4" />
                  ) : (
                    <Expand aria-hidden className="size-4" />
                  )
                }
              />
            ) : null}
            <HeaderButton
              label={copy.close}
              onClick={() => closeWindow()}
              icon={<X aria-hidden className="size-4" />}
            />
          </div>
        ) : null}

        {/* The screen. A transformed box is the containing block for the screens' own fixed layout, so they fill it. */}
        <div
          data-call-window-body
          className={cn(
            "@container relative min-h-0 flex-1 overflow-hidden",
            !full && !minimized && "rounded-b-3xl",
            minimized && !bubble && "hidden",
          )}
        >
          <div
            className="absolute left-0 top-0 h-full w-full overflow-auto"
            style={
              bubble
                ? {
                    transform: `scale(${BUBBLE.w / BUBBLE.innerW})`,
                    transformOrigin: "top left",
                    width: BUBBLE.innerW,
                    height: BUBBLE.innerH,
                  }
                : { transform: "translateZ(0)" }
            }
            aria-hidden={bubble ? true : undefined}
            inert={bubble ? true : undefined}
          >
            {body}
          </div>
          {bubble ? (
            <button
              type="button"
              aria-label={copy.returnToCall}
              onClick={() => dispatchWindow({ type: "restore" })}
              className="absolute inset-0"
            />
          ) : null}
        </div>

        {/* Edges and corners. */}
        {!full && mode === "EXPANDED"
          ? HANDLES.map((h) => (
              <div
                key={h.id}
                data-resize={h.id}
                aria-hidden
                onPointerDown={startResize(h.id)}
                style={{ cursor: h.cursor }}
                className={cn("absolute z-10 touch-none", h.className)}
              />
            ))
          : null}
      </div>

      {minimized && !bubble ? (
        <MinimizedBar
          label={barLabel}
          title={title}
          elapsed={elapsed}
          phone={phone}
          kind={target.kind}
        />
      ) : null}
      {mode === "EXPANDED" && target.kind === "room" && !phone ? (
        <p className="sr-only">{copy.footerHint}</p>
      ) : null}
    </>
  );
}

function HeaderButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-yellow-400"
    >
      {icon}
    </button>
  );
}

/** The minimized state: a bar with the timer, mute, a way back and hang up. A phone gets a thin bar to tap. */
function MinimizedBar({
  label,
  title,
  elapsed,
  phone,
  kind,
}: {
  label: string;
  title: string;
  elapsed: string;
  phone: boolean;
  kind: "call" | "room";
}) {
  const s = useLive();
  return (
    <div
      role="region"
      aria-label={label}
      data-call-window-bar
      className={cn(
        "fixed z-[62] flex items-center gap-2 bg-green-700 text-white shadow-lift",
        phone
          ? "inset-x-0 top-0 min-h-11 px-2 pt-[env(safe-area-inset-top)]"
          : "bottom-6 right-6 max-w-md rounded-full p-1.5 pl-4",
      )}
    >
      <button
        type="button"
        onClick={() => dispatchWindow({ type: "restore" })}
        aria-label={kind === "call" ? copy.returnToCall : copy.returnToRoom}
        className="min-h-11 min-w-0 flex-1 truncate text-left text-sm font-semibold"
      >
        {phone ? label : title}
        {elapsed ? <span className="tabular ml-2 font-normal text-white/80">{elapsed}</span> : null}
      </button>
      <button
        type="button"
        aria-label={s.micOn ? sessionCopy.controls.mute : sessionCopy.controls.unmute}
        aria-pressed={!s.micOn}
        onClick={() => void live().toggleMic()}
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          s.micOn ? "bg-white/15" : "bg-yellow-400 text-ink-950",
        )}
      >
        {s.micOn ? (
          <Mic aria-hidden className="size-5" />
        ) : (
          <MicOff aria-hidden className="size-5" />
        )}
      </button>
      {!phone ? (
        <button
          type="button"
          aria-label={kind === "call" ? copy.returnToCall : copy.returnToRoom}
          onClick={() => dispatchWindow({ type: "restore" })}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15"
        >
          <Maximize2 aria-hidden className="size-5" />
        </button>
      ) : null}
      <button
        type="button"
        aria-label={sessionCopy.modal.hangUp}
        onClick={() => closeWindow()}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger-600"
      >
        <PhoneOff aria-hidden className="size-5" />
      </button>
    </div>
  );
}
