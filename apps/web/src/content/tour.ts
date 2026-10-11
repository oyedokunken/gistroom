import { LIMITS } from "@gistroom/shared";

/** The first run walkthrough (R10). Steps are read from LIMITS so the words can never disagree with the app. */
export const tour = {
  open: "Take the tour",
  title: "Quick tour",
  next: "Next",
  back: "Back",
  skip: "Skip",
  done: "Start gisting",
  stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
  steps: [
    {
      id: "welcome",
      icon: "sparkles",
      title: "Welcome to Gistroom",
      body: "Here is a quick look at what you can do. It takes a minute.",
    },
    {
      id: "chats",
      icon: "message",
      title: "Reply, react and edit",
      body: `Swipe a message to the right to reply. Tap a message to react, star or delete it. You can edit a message for ${LIMITS.EDIT_WINDOW_MIN} minutes after you send it.`,
    },
    {
      id: "media",
      icon: "mic",
      title: "Voice notes and files",
      body: "Hold the mic to record a voice note. Send photos, videos and documents from the plus button.",
    },
    {
      id: "calls",
      icon: "phone",
      title: "Calls that switch",
      body: "Start on audio and turn the camera on any time. If your data is tight, drop back to audio with one tap.",
    },
    {
      id: "rooms",
      icon: "radio",
      title: "Rooms",
      body: "Start a room, or join a public one that matches your interests. Hosts and moderators keep it friendly.",
    },
    {
      id: "alerts",
      icon: "bell",
      title: "Never miss a call",
      body: "Turn on alerts in Settings and calls and messages reach you even when the tab is closed.",
    },
    {
      id: "safe",
      icon: "shield",
      title: "You are in control",
      body: "Block or report anyone from a chat or a profile. Private rooms are only for the people you invite.",
    },
  ],
} as const;
