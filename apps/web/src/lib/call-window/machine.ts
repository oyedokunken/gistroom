/**
 * The call window as a small state machine. It knows nothing about React or the screen: events go in, the next state
 * comes out. RINGING is the incoming ring card, EXPANDED the floating window, MINIMIZED the bar or bubble, FULLSCREEN the
 * whole screen, HIDDEN nothing at all (Section 16).
 */

export type WindowMode = "HIDDEN" | "RINGING" | "EXPANDED" | "MINIMIZED" | "FULLSCREEN";

export interface WindowTarget {
  kind: "call" | "room";
  /** A call id, or a room slug. */
  id: string;
  /** Answer as soon as the call screen opens (a notification's Answer button). */
  autoAnswer?: boolean;
  /** A room invite link token, kept so the room page can use it. */
  invite?: string | null;
}

export interface WindowState {
  mode: WindowMode;
  target: WindowTarget | null;
  /** Where Return goes after a minimize. */
  restoreTo: "EXPANDED" | "FULLSCREEN";
}

export type WindowEvent =
  /** Open a call or room. On a phone it opens full screen. */
  | { type: "open"; target: WindowTarget; phone?: boolean }
  | { type: "ring"; target: WindowTarget }
  | { type: "minimize" }
  | { type: "restore" }
  | { type: "fullscreen" }
  | { type: "exitFullscreen" }
  | { type: "toggleFullscreen" }
  /** The ring was declined, timed out, cancelled or answered somewhere else. */
  | { type: "dismissRing" }
  /** The window is closed, or the call or room it showed is over. */
  | { type: "close" };

export const initialWindow: WindowState = { mode: "HIDDEN", target: null, restoreTo: "EXPANDED" };

export function windowReducer(state: WindowState, event: WindowEvent): WindowState {
  switch (event.type) {
    case "open":
      return {
        mode: event.phone ? "FULLSCREEN" : "EXPANDED",
        target: event.target,
        restoreTo: event.phone ? "FULLSCREEN" : "EXPANDED",
      };
    case "ring":
      // A ring never replaces a window that is already showing a call or room.
      if (state.mode !== "HIDDEN") return state;
      return { ...state, mode: "RINGING", target: event.target };
    case "dismissRing":
      return state.mode === "RINGING" ? initialWindow : state;
    case "minimize":
      if (state.mode === "EXPANDED" || state.mode === "FULLSCREEN") {
        // Return goes back to whichever size it was minimized from.
        return { ...state, mode: "MINIMIZED", restoreTo: state.mode };
      }
      return state;
    case "restore":
      return state.mode === "MINIMIZED" ? { ...state, mode: state.restoreTo } : state;
    case "fullscreen":
      return state.mode === "EXPANDED" || state.mode === "MINIMIZED"
        ? { ...state, mode: "FULLSCREEN" }
        : state;
    case "exitFullscreen":
      return state.mode === "FULLSCREEN" ? { ...state, mode: "EXPANDED" } : state;
    case "toggleFullscreen":
      if (state.mode === "FULLSCREEN") return { ...state, mode: "EXPANDED" };
      return state.mode === "EXPANDED" ? { ...state, mode: "FULLSCREEN" } : state;
    case "close":
      return initialWindow;
  }
}

/** The ring card and the window are the only things that show something; HIDDEN shows nothing. */
export const isShowing = (state: WindowState): boolean => state.mode !== "HIDDEN";
/** Where the screen with the call or room in it is mounted. A ring has no screen yet. */
export const hasScreen = (state: WindowState): boolean =>
  state.mode === "EXPANDED" || state.mode === "MINIMIZED" || state.mode === "FULLSCREEN";
