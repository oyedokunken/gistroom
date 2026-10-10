export const microcopy = {
  emptyChats: "No gist yet. Pick a friend and start talking.",
  noChatSelected: "Pick a chat, or start a new one.",
  loading: "Abeg wait small.",
  offline: "You are offline. Your messages will send when the network returns.",
  reconnecting: "Reconnecting to the room. Hold on.",
  rateLimited: (seconds: number) => `Easy, easy. Try again in ${seconds} seconds.`,
  friendRequestUnavailable: "You can't send a request to this person right now.",
  roomFull: "This room is full. Try again in a minute.",
  notInvited: "You are not invited to this room. Ask the host for a link.",
  roomEnded: "This room has ended. Browse live rooms or start your own.",
  missedCall: (name: string) => `Missed call from ${name}.`,
  micBlocked:
    "Gistroom can't reach your microphone. Allow it in your browser settings, then try again.",
  cameraBlocked:
    "Camera is blocked. You are still in audio. Allow the camera in your browser settings to switch to video.",
  emptyNotifications: "Nothing new. We will tell you when something happens.",
  welcomeAfterOnboarding: "You are in. Find your people.",
  notFound: "This page is not here. Head back home.",
  installIos: "Add Gistroom to your Home Screen to get call and message alerts.",
} as const;
