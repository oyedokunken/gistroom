/**
 * Words for screen sharing in calls and rooms (R10). Plain, no slang: it is about what other people can see of your
 * screen. Each line says what happened and what to do next.
 */
export const presentCopy = {
  control: {
    present: "Present now",
    stop: "Stop presenting",
    busy: "Someone is presenting",
    groupLabel: "Screen sharing",
    starting: "Starting",
  },
  /** Said before the first share, and before any share on data saver or a weak line. */
  prepare: {
    title: "Present your screen?",
    body: "Everyone in this call can see what is on the screen, window or tab you choose. That can include private messages, notifications and other tabs, so close anything you do not want shared first.",
    bodyRoom:
      "Everyone in this room can see what is on the screen, window or tab you choose. That can include private messages, notifications and other tabs, so close anything you do not want shared first.",
    remember: "Do not show this again on this device",
    choose: "Choose what to present",
    cancel: "Not now",
    reducedTitle: "Present at reduced quality?",
    reducedDataSaver:
      "Data saver is on, so your screen goes out smaller and slower to use less data. Text can look soft.",
    reducedWeak:
      "Your connection is weak, so your screen goes out smaller and slower to keep the call smooth. Text can look soft.",
    reducedChoose: "Present at reduced quality",
  },
  busy: {
    title: (name: string) => `${name} is presenting`,
    body: "Only one person presents at a time. Ask for a turn and they can say yes. Nothing changes until they do.",
    bodyMod:
      "Only one person presents at a time. Ask for a turn, or take over, which stops their presentation right away and is written in the moderator log.",
    ask: "Ask to present",
    takeOver: "Take over",
    cancel: "Cancel",
    takeOverTitle: (name: string) => `Take over from ${name}?`,
    takeOverBody: "Their presentation stops now and you choose what to present.",
  },
  request: {
    title: (name: string) => `${name} wants to present`,
    body: "If you allow, your presentation stops so they can start. They have 30 seconds to begin.",
    allow: "Allow",
    decline: "Not now",
    waiting: (name: string) => `Waiting for ${name} to answer.`,
    cancelAsk: "Cancel request",
    denied: (name: string) => `${name} said not now.`,
    expired: (name: string) => `${name} did not answer. You can ask again.`,
    sent: "Request sent. You will see their answer here.",
  },
  handoff: {
    title: "Your turn to present",
    body: "The presenter handed over to you. Choose what to present within 30 seconds.",
    present: "Present now",
    later: "Not now",
  },
  /** What a person sees and hears while someone presents. */
  live: {
    you: "You are presenting",
    youBody: "Everyone can see your shared screen. Your camera and microphone are not affected.",
    youTile: "You are presenting your screen",
    youTileBody: "Others see it in full. It is not shown here so it does not repeat itself.",
    presenting: (name: string) => `${name} is presenting`,
    badge: "Presenting",
    screenOf: (name: string) => `Screen shared by ${name}`,
    pin: "Enlarge",
    unpin: "Back to grid",
    fullscreen: "Full screen",
    hide: "Hide for me",
    show: "Show their screen",
    hiddenTitle: (name: string) => `${name}'s screen is hidden for you`,
    stopForEveryone: "Stop their presentation",
    stopForEveryoneTitle: (name: string) => `Stop ${name}'s presentation?`,
    stopForEveryoneBody: "Their screen disappears for everyone. They can ask to present again.",
    mini: "Presenting",
  },
  notice: {
    close: "Dismiss",
    unsupported:
      "This browser can not share a screen. Use a recent Chrome, Edge, Firefox or Safari on a computer. You can still watch when someone else presents.",
    mobile:
      "Most phone browsers can not share a screen. Open Gistroom on a computer to present. You can still watch when someone else presents.",
    insecure: "Screen sharing needs a secure connection. Open Gistroom over https and try again.",
    denied:
      "Screen sharing was blocked or the picker was closed. Choose a screen, window or tab when the browser asks, or allow screen sharing for this site in the browser settings, then try again. On a Mac, also allow your browser under System Settings, Privacy and Security, Screen Recording.",
    failed: "Presenting did not start. Check your connection and try again.",
    failedBrowser:
      "The browser could not capture that source. Pick another screen, window or tab and try again.",
    browserEnded: "Presenting stopped because the browser ended the share.",
    youStopped: "You stopped presenting.",
    tookOver: (name: string) => `${name} took over, so your presentation stopped.`,
    stoppedByMod: "A moderator stopped your presentation.",
    handedOver: (name: string) => `You handed over to ${name}.`,
    connecting: "Still connecting. Try again in a moment.",
    notAllowed: "You can not present in this call right now.",
    ended: "This session has ended, so nothing can be presented.",
    reserved: "A turn is being handed over. Try again in a few seconds.",
    lost: "Your presentation stopped because the connection to it was lost.",
  },
  chips: {
    started: (name: string) => `${name} is presenting`,
    stopped: (name: string) => `${name} stopped presenting`,
    youStopped: "You stopped presenting",
    forced: (name: string) => `A moderator stopped ${name}'s presentation`,
  },
} as const;
