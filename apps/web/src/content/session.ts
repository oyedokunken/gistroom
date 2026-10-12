/**
 * Words for connection states, call and room modals, chips and banners (R10). Plain, warm, no slang in anything about
 * connection or safety. Each line says what happened and what to do next.
 */
export const session = {
  back: "You're back",
  backOnline: "Back online",
  offlineBar: "You're offline. Messages will send when you're back.",
  needsConnection: "Needs a connection",
  connectingChat: "Connecting to chat...",
  chatSlow: "Taking longer than usual. Chat still works.",
  switching: "Switching networks",
  serverDown: "We can't reach Gistroom right now",
  modal: {
    close: "Close",
    leave: "Leave",
    tryAgain: "Try again",
  },
} as const;
