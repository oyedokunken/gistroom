/** Words for the floating call and room window. */
export const callWindow = {
  label: (title: string) => `Call window: ${title}`,
  callTitle: "Call",
  move: "Move window",
  resize: "Resize window",
  minimize: "Minimize",
  restore: "Restore window",
  fullscreen: "Full screen",
  exitFullscreen: "Exit full screen",
  close: "Close",
  openFullRoom: "Open full room",
  popOut: "Pop out",
  popOutBlocked: "Your browser could not open the pop out window.",
  returnToCall: "Return to call",
  returnToRoom: "Return to room",
  tapToReturnCall: "In call, tap to return",
  tapToReturnRoom: "In room, tap to return",
  leaveCallTitle: "Leave this call?",
  leaveCallBody: "The call ends for you and for the other person.",
  leaveRoomTitle: "Leave this room?",
  leaveRoomBody: "You can come back while it is live.",
  leave: "Leave",
  stay: "Stay",
  swapTitle: (current: "call" | "room", next: "call" | "room") =>
    current === "call"
      ? next === "room"
        ? "Leave your current call to join this room?"
        : "Leave your current call to start another?"
      : next === "room"
        ? "Leave your current room to join this one?"
        : "Leave your current room to make this call?",
  swapBody: "You can only be in one call or room at a time.",
  swapConfirm: (next: "call" | "room") => (next === "room" ? "Leave and join" : "Leave and call"),
  detailsHeading: "This room is open in the call window",
  detailsBody: "It floats over the page, so you can keep browsing while you talk.",
  detailsOpen: "Open the window",
  detailsBack: "Browse live rooms",
  live: "Live",
  upcoming: "Upcoming",
  opening: "Opening the room",
  openingCall: "Opening your call",
  openingCallBody: "It opens in the call window.",
  footerHint: "Drag the title bar to move it. Drag an edge or corner to resize.",
} as const;
