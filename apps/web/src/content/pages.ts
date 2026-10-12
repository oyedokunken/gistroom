import type { FaqItem } from "@/components/public/faq";
import { alertsHelp } from "@/content/alerts-help";
import type { Section } from "@/components/public/prose-page";

/** Copy for the public pages (R10). Plain, warm, specific. No numbers or logos that are not real. */

export const faqItems: readonly FaqItem[] = [
  {
    question: "Who can use Gistroom?",
    answer:
      "Anyone who is 18 or older. Gistroom is built for Nigerians talking about Nigeria, but we do not check where you are from and we never claim to.",
  },
  {
    question: "Do I need a password?",
    answer:
      "You confirm your email with a code once, when you sign up. After that you sign in with your email and password, or with Google. You only get a code again if you forget your password.",
  },
  {
    question: "Who can message or call me?",
    answer:
      "Only your friends. Someone has to send a friend request and you have to accept it before they can chat with you, call you or invite you to a room.",
  },
  {
    question: "Will I get alerts when the app is closed?",
    answer:
      "Yes, once you turn alerts on for that device. Calls, messages and friend requests reach you through your browser or your installed app. On iPhone, add Gistroom to your Home Screen first.",
  },
  {
    question: "How does it work on mobile data?",
    answer:
      "Audio comes first. Data saver starts calls with audio only and keeps video at a lower quality. You can switch to video in the middle of a call when you want to.",
  },
  {
    question: "What is a room?",
    answer:
      "A room is a live group call for up to 32 people. Anyone can start one on the spot or schedule it. Public rooms show up on the rooms page, private rooms are only for people who are invited.",
  },
  {
    question: "How do I report someone or something?",
    answer:
      "Use the report option on a profile, a message, a call or a room. You can also write to safety@gistroom.ng. We keep the last messages as evidence so we can act on a report.",
  },
  {
    question: "How do I delete my account?",
    answer:
      "Open Settings and choose Delete account. We ask you to confirm with a code sent to your email. Your files are removed and you show as Deleted user in other people's chats.",
  },
];

export const troubleshooting: readonly FaqItem[] = [
  {
    question: "I do not get alerts when the app is closed",
    answer:
      "Open Settings, then Notifications, and turn alerts on for this device. Check that your browser allows notifications for Gistroom. Some Android phones stop background apps to save battery, so allow Gistroom to run in the background. Missed calls always show in your call log.",
  },
  ...alertsHelp.items.map((i) => ({ question: i.question, answer: i.answer })),
  {
    question: "Gistroom cannot reach my microphone",
    answer:
      "Allow the microphone for Gistroom in your browser settings, then try again. Make sure no other app is using it.",
  },
  {
    question: "My camera is blocked",
    answer:
      "You stay in the call with audio. Allow the camera for Gistroom in your browser settings, then switch to video.",
  },
  {
    question: "I cannot find the install option",
    answer:
      "On Android and desktop Chrome or Edge, use the Install button in Settings or the install icon in the address bar. On iPhone, open Gistroom in Safari, tap Share, then Add to Home Screen.",
  },
  {
    question: "My code did not arrive",
    answer:
      "Check your spam folder and wait a minute, then ask for a new code. You can ask for up to five codes in an hour.",
  },
];

export const features = {
  title: "Features",
  description:
    "Friends, chats, calls and live rooms in one app. Audio first, built for Nigerian data.",
  lead: "Everything you need to gist with your people, live, without burning your data.",
  sections: [
    {
      id: "friends",
      heading: "Friends first",
      body: [
        "Search for people by name or username. Send a request and chat once it is accepted. Nobody can message you out of the blue.",
        "If you block someone, you stop being friends, they cannot reach you, and neither of you shows up in the other's search.",
      ],
    },
    {
      id: "chats",
      heading: "Chat all you want, anytime",
      bullets: [
        "Bubbles with the time on every message, in your own time zone",
        "Voice notes, photos, videos and files",
        "Reply, react, star and delete for yourself or for everyone",
        "Typing, delivered and read, with read receipts you can switch off",
        "Archive a chat and it stays archived, even when new messages come in",
      ],
    },
    {
      id: "calls",
      heading: "Switch anytime",
      body: [
        "Start a call on audio and turn your camera on in the middle of it, or drop the video and keep talking when data gets tight. No hanging up, no calling back.",
        "If the network gets weak, Gistroom offers to switch to audio only so the conversation keeps going.",
      ],
    },
    {
      id: "rooms",
      heading: "A room for every gist",
      body: [
        "Start a room on the spot or schedule one. Pick a topic and a language: English, Pidgin, Yoruba, Igbo or Hausa. Make it public or keep it private for the people you invite.",
        "Moderators can mute, remove and ban, lock the room and delete room chat. The host sees a log of every moderator action.",
      ],
    },
    {
      id: "alerts",
      heading: "Alerts that find you",
      body: [
        "Turn on alerts and calls and messages reach you through your browser or installed app, even if you closed the tab last night. Set quiet hours when you need peace.",
      ],
    },
    {
      id: "data",
      heading: "Built for Nigerian data",
      body: [
        "Data saver is on by default. Calls start with audio, video is capped at a lower quality, and images are compressed on your phone before they upload.",
      ],
    },
  ] satisfies Section[],
};

export const about = {
  title: "About",
  description: "Gistroom is a place to talk about Nigeria out loud, built in Nigeria.",
  lead: "Nigerians have a lot to say. Gistroom gives it somewhere to go.",
  sections: [
    {
      id: "why",
      heading: "Why we built it",
      body: [
        "The best conversations in Nigeria happen out loud: under an umbrella, in a barbershop, on a rooftop, in a danfo. Most apps squeeze that into text or burn through your data trying to carry it.",
        "Gistroom puts the voice first. Rooms are quick to start, calls work on weak networks, and the app is made for the way people here actually talk.",
      ],
    },
    {
      id: "principles",
      heading: "What we hold to",
      bullets: [
        "Audio first, video when you want it",
        "Friends only for private chats and calls",
        "Safety is part of the design: block, report, moderators and private rooms",
        "We never claim to verify people we do not verify",
        "No made-up numbers, reviews or logos",
      ],
    },
  ] satisfies Section[],
};

export const security = {
  title: "Security",
  description: "How Gistroom protects your account, your messages and your media.",
  lead: "What we do to keep your account and your conversations safe, in plain words.",
  sections: [
    {
      id: "account",
      heading: "Your account",
      bullets: [
        "A one time code confirms your email when you sign up",
        "Passwords are stored as salted hashes, never in plain text",
        "Wrong password and wrong code attempts are limited and locked",
        "You can see every device that is signed in and sign any of them out",
        "We tell you when your account is signed in on a new device",
      ],
    },
    {
      id: "messages",
      heading: "Messages and media",
      bullets: [
        "Everything travels over HTTPS and secure web sockets",
        "Chat media sits in a private store and opens through short lived links",
        "Photos lose their location and camera details before they upload",
        "Uploads are checked by their real file type, not just their name",
      ],
    },
    {
      id: "limits",
      heading: "What we do not claim",
      body: [
        "Gistroom does not use end to end encryption yet, so we do not describe it that way. We can read message data on our servers when we need to act on a report. Do not share anything you would not want a moderator to see in a report.",
      ],
    },
    {
      id: "report",
      heading: "Found a problem?",
      body: [
        "Write to security@gistroom.ng with what you found and how to repeat it. Please do not post it publicly first. We reply within three working days.",
      ],
    },
  ] satisfies Section[],
};

export const safety = {
  title: "Safety",
  description: "Community guidelines, how to block and report, and how to reach us about abuse.",
  lead: "Gistroom works when people feel safe to speak. These are the rules and the tools.",
  sections: [
    {
      id: "guidelines",
      heading: "Community guidelines",
      bullets: [
        "Be respectful. Argue about ideas, not about who people are",
        "No hate, threats, harassment or bullying",
        "No sharing private information about other people",
        "No scams, fraud or impersonation",
        "No sexual content involving anyone under 18, ever",
        "No illegal content. The Cybercrimes Act applies to what you say and share here",
      ],
    },
    {
      id: "tools",
      heading: "Your tools",
      bullets: [
        "Block anyone from their profile, a chat, a call screen or a room",
        "Report a person, a message, a room or a room message",
        "Choose who can invite you to rooms",
        "Turn off read receipts and presence",
        "Keep a room private and share the link only with people you trust",
      ],
    },
    {
      id: "moderation",
      heading: "How moderation works",
      body: [
        "Room hosts and moderators can mute, remove and ban people from their room. Every moderator action is logged for the host.",
        "When you report something, we keep the recent messages as evidence and a person on our side reviews it. We can warn, suspend or remove accounts.",
      ],
    },
    {
      id: "contact",
      heading: "Abuse and takedown requests",
      body: [
        "To report abusive content or ask us to take something down, write to safety@gistroom.ng. Tell us where it is and why it breaks the guidelines or the law.",
      ],
    },
  ] satisfies Section[],
};

export const install = {
  title: "Install",
  description:
    "Add Gistroom to your phone or computer for faster opening and alerts when the app is closed.",
  lead: "Gistroom installs from your browser. No app store, no big download.",
  sections: [
    {
      id: "android",
      heading: "Android",
      bullets: [
        "Open Gistroom in Chrome",
        "Tap Install in the banner, or the menu and then Install app",
        "Open Gistroom from your Home Screen and turn on alerts",
      ],
    },
    {
      id: "ios",
      heading: "iPhone and iPad",
      body: [
        "Add Gistroom to your Home Screen to get call and message alerts. Alerts only work from the installed app on iPhone.",
      ],
      bullets: [
        "Open Gistroom in Safari",
        "Tap the Share button, then Add to Home Screen",
        "Open Gistroom from your Home Screen and sign in once inside the installed app",
        "Then turn on alerts in Settings",
      ],
    },
    {
      id: "desktop",
      heading: "Windows, Mac and Linux",
      bullets: [
        "Open Gistroom in Chrome or Edge",
        "Click the install icon in the address bar",
        "Gistroom opens in its own window",
      ],
    },
  ] satisfies Section[],
};

export const changelog = {
  title: "Changelog",
  description: "What changed in Gistroom and when.",
  lead: "A running list of what we have built and fixed.",
  closing: {
    title: "See it live, not just in the notes.",
    body: "Open Gistroom and try the things on this list for yourself.",
  },
};

export const support = {
  title: "Support",
  description: "Answers, troubleshooting and a way to reach us.",
  lead: "Find an answer fast, or write to us.",
  contactHeading: "Write to us",
  faqHeading: "Common questions",
  troubleHeading: "Troubleshooting",
  closing: {
    title: "We have got you.",
    body: "Open Gistroom and get talking. If anything goes wrong, you know where to find us.",
  },
};

export const roomsPage = {
  title: "Live rooms",
  description: "Drop into a conversation already going on. Public rooms by topic and language.",
  lead: "Public rooms happening now, and the ones coming up.",
  liveHeading: "Live now",
  soonHeading: "Coming up",
  emptyTitle: "No rooms live right now",
  emptyBody: "Start one and let people join the gist.",
  refresh: "Refresh rooms",
  start: "Start a room",
  topicLabel: "Topic",
  languageLabel: "Language",
  allTopics: "All topics",
  allLanguages: "All languages",
  join: "Join",
  scheduled: (when: string) => `Starts ${when}`,
  how: {
    title: "How a room works",
    lead: "No setup, no downloads. A room is a live group call that ends when the gist does.",
    steps: [
      {
        icon: "open-gist" as const,
        title: "Start in one tap",
        body: "Pick a topic, choose public or private, and the room is live.",
      },
      {
        icon: "friends" as const,
        title: "People join",
        body: "Public rooms show on this page. Private rooms only open through your invite link.",
      },
      {
        icon: "moderator" as const,
        title: "Hosts keep it calm",
        body: "Mute, remove, ban and lock. Every moderator action is logged.",
      },
      {
        icon: "speed" as const,
        title: "It ends when it ends",
        body: "The room disbands when the host closes it or everyone leaves. Chats between friends stay forever.",
      },
    ],
  },
  browse: {
    title: "Browse by topic",
    lead: "Every room lives under a topic. Pick a card and open its page to see what is live there.",
  },
  kinds: {
    title: "Public, private and your language",
    lead: "Two ways to gist, five ways to say it.",
    items: [
      {
        icon: "open-gist" as const,
        title: "Public rooms",
        body: "Anyone can find and join them from this page. Good for open gist on the big topics.",
      },
      {
        icon: "private-room" as const,
        title: "Private rooms",
        body: "Only people with your invite link get in. You can revoke the link any time.",
      },
      {
        icon: "voice" as const,
        title: "Your language",
        body: "Tag English, Pidgin, Yoruba, Igbo or Hausa so people know what to expect before they join.",
      },
    ],
  },
  closing: {
    title: "The gist is already going.",
    body: "Start your own room in one tap, or drop into one that is live right now.",
  },
};

export const topicsPage = {
  intro: (name: string) => `Rooms and conversations about ${name.toLowerCase()}.`,
  liveHeading: "Live rooms",
  none: "No live rooms on this topic right now.",
  start: "Start a room on this topic",
  other: "Other topics",
  closing: {
    title: (name: string) => `The ${name.toLowerCase()} gist will not wait.`,
    body: "Start a room on this topic and let people come meet you inside.",
  },
  scenes: {
    football: "scene-football-centre",
    "music-and-gbedu": "scene-rooftop",
    "politics-and-governance": "scene-danfo",
    "tech-and-startups": "scene-keke",
    "business-and-money": "scene-danfo",
    relationships: "scene-barbershop",
    "religion-and-spirituality": "scene-rooftop",
    "news-and-current-affairs": "scene-danfo",
    "law-and-justice": "scene-door-check",
    agriculture: "scene-village-square",
    "other-sports": "scene-street-football",
    "travel-and-tourism": "scene-keke",
    "campus-life": "scene-village-square",
    "nollywood-and-entertainment": "scene-rooftop",
    "food-and-chop": "scene-suya",
    "health-and-wellness": "scene-barbershop",
    "careers-and-jobs": "scene-door-check",
    education: "scene-help-desk",
    comedy: "scene-street-football",
    "diaspora-and-japa": "scene-danfo",
    "fashion-and-owambe": "scene-rooftop",
    gaming: "scene-street-football",
    "open-gist": "scene-village-square",
  } as Record<string, import("@/components/public/sections").CtaSceneName>,
};

export const legal = {
  updated: "Last updated 10 October 2026",
};

export const privacy = {
  title: "Privacy",
  description: "What Gistroom collects, why, how long we keep it, and your rights under the NDPA.",
  lead: "We collect what we need to run Gistroom and nothing we do not need. This page explains it.",
  closing: {
    title: "Your gist stays yours.",
    body: "Now you know what we keep and why. Come and see it working for yourself.",
  },
  sections: [
    {
      id: "who",
      heading: "Who we are",
      icon: "account" as const,
      body: [
        "Gistroom is run from Nigeria. For privacy questions or to use your rights, write to support@gistroom.ng.",
      ],
    },
    {
      id: "collect",
      heading: "What we collect",
      icon: "privacy" as const,
      bullets: [
        "Account details: your email, name, username, profile photo and bio",
        "Your sign in method and a salted hash of your password if you set one",
        "Messages, voice notes, photos, videos and files you send, and the call and room records you create",
        "Devices signed in to your account, with a coarse device name and last active time",
        "Settings such as privacy, notifications and data saver",
        "Basic technical data such as your IP address for security and rate limits",
      ],
    },
    {
      id: "use",
      heading: "Why we use it",
      icon: "idea" as const,
      bullets: [
        "To run the service: deliver messages, connect calls and rooms, and send alerts you asked for",
        "To keep people safe: stop abuse, review reports and enforce our rules",
        "To keep the service secure and working: rate limits, fraud checks and fixing bugs",
        "To contact you about your account, such as sign in codes and security notices",
      ],
    },
    {
      id: "share",
      heading: "Who we share it with",
      icon: "invites" as const,
      body: [
        "We use service providers to run Gistroom: hosting, a database and file store, a calling provider, email delivery, and Google when you choose to sign in with Google. They only get what they need to do that job.",
        "We do not sell your data. We share information with authorities only when the law requires it.",
      ],
    },
    {
      id: "keep",
      heading: "How long we keep it",
      icon: "starred" as const,
      bullets: [
        "Chats and media stay until you or the other person delete them, or until you delete your account",
        "Room chat is removed 24 hours after a room ends, kept only so reports can be handled",
        "Expired codes and old sessions are cleaned up regularly",
        "Reports are kept so we can protect people, even after an account is deleted",
      ],
    },
    {
      id: "rights",
      heading: "Your rights",
      icon: "law" as const,
      body: [
        "Under the Nigeria Data Protection Act you can ask to see your data, correct it, export it and delete it. You can export your data and delete your account from Settings. For anything else, write to support@gistroom.ng.",
      ],
    },
    {
      id: "children",
      heading: "Age",
      icon: "children" as const,
      body: [
        "Gistroom is for people who are 18 or older. If we find an account that belongs to someone younger, we remove it.",
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      icon: "honest" as const,
      body: [
        "If we change this page in a way that matters, we tell you in the app before it takes effect.",
      ],
    },
  ] satisfies Section[],
};

export const terms = {
  title: "Terms",
  description: "The rules for using Gistroom.",
  lead: "By using Gistroom you agree to these terms. They are short on purpose.",
  closing: {
    title: "Fair rules, fair gist.",
    body: "Short terms on purpose, so the talking can start. Come and gist.",
  },
  sections: [
    {
      id: "use",
      heading: "Using Gistroom",
      icon: "open-gist" as const,
      bullets: [
        "You must be 18 or older",
        "You are responsible for your account and for what you say and share",
        "Keep your sign in details private",
        "Follow the Acceptable use rules and the law, including the Cybercrimes Act",
      ],
    },
    {
      id: "content",
      heading: "Your content",
      icon: "media" as const,
      body: [
        "You own what you create. You give us permission to store it, send it to the people you choose and show it as part of the service. When you delete something, we remove it from the service, except where we must keep a copy for a report or by law.",
      ],
    },
    {
      id: "safety",
      heading: "Safety and enforcement",
      icon: "moderator" as const,
      body: [
        "We can remove content, end rooms, suspend or delete accounts that break these terms or the law. We try to tell you why when we do.",
      ],
    },
    {
      id: "service",
      heading: "The service",
      icon: "tools" as const,
      body: [
        "We work to keep Gistroom running, but we cannot promise it will always be available or free of mistakes. We may change or stop features. Calls and alerts depend on your network and device.",
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      icon: "honest" as const,
      body: [
        "To the extent the law allows, Gistroom is provided as it is, and we are not liable for losses that come from using it, or from what other people say or do on it.",
      ],
    },
    {
      id: "law",
      heading: "Governing law",
      icon: "law" as const,
      body: ["These terms are governed by the laws of the Federal Republic of Nigeria."],
    },
    {
      id: "contact",
      heading: "Contact",
      icon: "invites" as const,
      body: ["Questions about these terms: support@gistroom.ng."],
    },
  ] satisfies Section[],
};

export const cookies = {
  title: "Cookies",
  description: "The cookies and local storage Gistroom uses, and how to control them.",
  lead: "We use a small number of cookies. Most are needed to keep you signed in.",
  closing: {
    title: "Only the crumbs we need.",
    body: "Your choices stay yours to change. Ready to gist?",
  },
  sections: [
    {
      id: "essential",
      heading: "Essential",
      icon: "account" as const,
      bullets: [
        "Your sign in cookie keeps you signed in. It is private to your browser and expires after 30 days of no use",
        "A short lived cookie holds the state for Google sign in",
        "One cookie remembers your cookie choices",
      ],
    },
    {
      id: "functional",
      heading: "Functional",
      icon: "theme" as const,
      bullets: [
        "Your theme choice, unsent message drafts and recent emoji are stored in your browser storage",
        "Your outgoing message queue is stored in your browser so messages can send when the network returns",
      ],
    },
    {
      id: "analytics",
      heading: "Analytics",
      icon: "speed" as const,
      body: [
        "We do not load analytics today. If we add it, it stays off until you say yes in the cookie banner.",
      ],
    },
    {
      id: "control",
      heading: "Your choices",
      icon: "privacy" as const,
      body: [
        "Change your choices any time with the Cookie settings button in the footer, or clear site data in your browser.",
      ],
    },
  ] satisfies Section[],
};

export const acceptableUse = {
  title: "Acceptable use",
  description: "What is not allowed on Gistroom.",
  lead: "Plain rules so everyone knows where the line is.",
  closing: {
    title: "Good gist only.",
    body: "That is all the rules are for. Come be part of it.",
  },
  sections: [
    {
      id: "not-allowed",
      heading: "Do not",
      icon: "no-hate" as const,
      bullets: [
        "Threaten, harass, bully or hate on anyone",
        "Share sexual content involving minors, or any content that exploits people",
        "Share someone's private details or intimate images without consent",
        "Scam, cheat, impersonate or spread malware",
        "Spam people with requests, messages or room invites",
        "Record or share a call or room outside Gistroom without permission",
        "Try to break, probe or overload Gistroom",
        "Break the law, including the Cybercrimes Act",
      ],
    },
    {
      id: "rooms",
      heading: "In rooms",
      icon: "open-gist" as const,
      bullets: [
        "Follow the host and moderators",
        "Do not disrupt a room on purpose",
        "Do not bring in people to attack someone",
      ],
    },
    {
      id: "enforcement",
      heading: "What happens if you break these",
      icon: "law" as const,
      body: [
        "We can warn you, mute or remove you from a room, suspend your account or delete it. We may pass serious cases to the authorities.",
      ],
    },
    {
      id: "report",
      heading: "Report a problem",
      icon: "report" as const,
      body: ["Use the report option in the app, or write to safety@gistroom.ng."],
    },
  ] satisfies Section[],
};

export const contactForm = {
  nameLabel: "Your name",
  namePlaceholder: "Adaeze Okafor",
  emailLabel: "Your email",
  emailPlaceholder: "adaeze@example.com",
  messageLabel: "How can we help?",
  messageHelp: "Tell us what happened and what you expected.",
  send: "Send message",
  sending: "Sending",
  doneTitle: "Message sent",
  doneBody:
    "We got your message and sent a copy to your email. We reply within a few working days.",
  failed: "We could not send your message. Try again in a moment or write to support@gistroom.ng.",
  honeypot: "Leave this empty",
} as const;
