/** The real reasons alerts stop. Shown in Settings and mirrored on the Support page, so both always agree. */
export const alertsHelp = {
  heading: "Not getting alerts?",
  intro:
    "Alerts come from your browser and your phone, not from your sign in. They keep working after your session ends. These are the usual reasons they stop:",
  items: [
    {
      question: "Notifications are blocked",
      answer:
        "Open the lock icon next to the address, choose Site settings and set Notifications to Allow. Then come back here and press Send a test notification.",
    },
    {
      question: "The browser is fully closed on a Mac",
      answer:
        "On a Mac, Chrome and Edge only deliver alerts while the browser is running. Quit it completely and nothing arrives until you open it again. Keep it open in the background, or install Gistroom as an app.",
    },
    {
      question: "Battery saver or app killers on some Android phones",
      answer:
        "Some phones, including many Tecno, Infinix, Itel and Xiaomi models, stop apps in the background to save battery. Allow Gistroom (and Chrome) to run in the background, turn off battery saver for them, and lock them in the recent apps list.",
    },
    {
      question: "iPhone needs the app on the Home Screen",
      answer:
        "On iPhone and iPad, alerts only work for the installed app. Open Gistroom in Safari, tap Share, choose Add to Home Screen, open it from there and sign in once inside the installed app.",
    },
    {
      question: "Windows Chrome background setting",
      answer:
        "In Chrome, open Settings, then System, and turn on Continue running background apps when Google Chrome is closed. Without it, alerts stop when every Chrome window is closed.",
    },
    {
      question: "Your session ended",
      answer:
        "Alerts continue for up to 30 days after you are signed out, with plain text only and no names. Open Gistroom and sign in to get full alerts again.",
    },
  ],
} as const;
