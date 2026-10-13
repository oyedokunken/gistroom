"use client";

import { create } from "zustand";
import { callWindow as copy } from "@/content/call-window";
import { live, useLive } from "@/lib/live/live-session";
import { showSessionModal } from "@/lib/session/modals";
import { defaultRect, isPhone, parseRect, type Rect } from "./geometry";
import {
  initialWindow,
  windowReducer,
  type WindowEvent,
  type WindowState,
  type WindowTarget,
} from "./machine";

const STORE_KEY = "gr_callwindow";

interface WindowStore {
  state: WindowState;
  /** Where the floating window sits. Null until the first time it is shown. */
  rect: Rect | null;
  /** Whose saved position was loaded, so a second person on the same browser starts fresh. */
  owner: string | null;
  dispatch: (event: WindowEvent) => void;
  setRect: (rect: Rect) => void;
  setOwner: (userId: string) => void;
}

const viewport = () =>
  typeof window === "undefined"
    ? { w: 1280, h: 720 }
    : { w: window.innerWidth, h: window.innerHeight };

/** The saved size and place are a convenience for this person on this device. They are never needed. */
function readSaved(userId: string): Rect | null {
  try {
    const raw = window.localStorage.getItem(`${STORE_KEY}:${userId}`);
    return raw ? parseRect(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeSaved(userId: string, rect: Rect): void {
  try {
    window.localStorage.setItem(`${STORE_KEY}:${userId}`, JSON.stringify(rect));
  } catch {
    // Without storage the window simply starts top right next time.
  }
}

export const useCallWindow = create<WindowStore>((set, get) => ({
  state: initialWindow,
  rect: null,
  owner: null,
  dispatch: (event) => set((s) => ({ state: windowReducer(s.state, event) })),
  setRect: (rect) => {
    set({ rect });
    const owner = get().owner;
    if (owner) writeSaved(owner, rect);
  },
  setOwner: (userId) => {
    if (get().owner === userId) return;
    set({ owner: userId, rect: readSaved(userId) ?? defaultRect(viewport()) });
  },
}));

export const dispatchWindow = (event: WindowEvent) => useCallWindow.getState().dispatch(event);

/** Open straight away. Full screen on a phone, where there is no room to float. */
function show(target: WindowTarget): void {
  dispatchWindow({ type: "open", target, phone: isPhone(viewport()) });
}

/**
 * One call or room at a time. When something else is live, ask first and open only after the person has left it.
 * The answer is a dialog above everything, never a silent switch.
 */
export function confirmLeaveCurrent(next: "call" | "room", refId = ""): Promise<boolean> {
  const s = useLive.getState();
  const busy = s.kind !== null && s.status !== "idle" && s.refId !== refId;
  if (!busy || !s.kind) return Promise.resolve(true);
  const current = s.kind;
  return new Promise<boolean>((resolve) => {
    showSessionModal({
      id: "swap-session",
      priority: "info",
      icon: "log-out",
      title: copy.swapTitle(current, next),
      body: copy.swapBody,
      actions: [
        {
          id: "leave",
          label: copy.swapConfirm(next),
          run: async () => {
            await live().hangUp();
            dispatchWindow({ type: "close" });
            resolve(true);
          },
        },
        { id: "stay", label: copy.stay, kind: "secondary" },
      ],
      // Closing it any other way is the same as staying. The first answer wins.
      onClose: () => resolve(false),
    });
  });
}

/** Thrown by a call start that the person backed out of at "Leave your current room?". Callers say nothing for it. */
export class StartCancelled extends Error {
  constructor() {
    super("start cancelled");
    this.name = "StartCancelled";
  }
}
export const isStartCancelled = (e: unknown): boolean => e instanceof StartCancelled;

export function openCall(
  callId: string,
  opts: { autoAnswer?: boolean; audioOnly?: boolean } = {},
): void {
  show({ kind: "call", id: callId, autoAnswer: opts.autoAnswer, audioOnly: opts.audioOnly });
}

/** Opens a room in the window. Starting from another call or room asks to leave that one first. */
export function openRoom(slug: string, opts: { invite?: string | null } = {}): void {
  void confirmLeaveCurrent("room", slug).then((ok) => {
    if (ok) show({ kind: "room", id: slug, invite: opts.invite ?? null });
  });
}

export const minimizeWindow = () => dispatchWindow({ type: "minimize" });
export const restoreWindow = () => dispatchWindow({ type: "restore" });

/**
 * Close asks first when a call or room is live, because closing leaves it. With nothing live (it ended, or the room
 * page was only open) it just closes.
 */
export function closeWindow(): void {
  const s = useLive.getState();
  const target = useCallWindow.getState().state.target;
  const liveHere = s.kind !== null && s.status !== "idle" && (!target || s.refId === target.id);
  if (!liveHere || !s.kind) {
    dispatchWindow({ type: "close" });
    return;
  }
  const isCall = s.kind === "call";
  showSessionModal({
    id: "close-window",
    priority: "info",
    icon: "log-out",
    title: isCall ? copy.leaveCallTitle : copy.leaveRoomTitle,
    body: isCall ? copy.leaveCallBody : copy.leaveRoomBody,
    actions: [
      {
        id: "leave",
        label: copy.leave,
        kind: "danger",
        run: async () => {
          await live().hangUp();
          dispatchWindow({ type: "close" });
        },
      },
      { id: "stay", label: copy.stay, kind: "secondary" },
    ],
  });
}
