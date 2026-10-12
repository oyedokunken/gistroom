import { maker } from "./maker";

/**
 * Copy for the designed public pages (R10). Every number here is a real product setting, not a claim about
 * users. Sample names in the device mocks are labeled as sample on the page.
 */

export const cta = {
  enter: { label: "Enter Gistroom", href: "/signup" },
  open: { label: "Open Gistroom", href: "/app/discover" },
  rooms: { label: "See live rooms", href: "/rooms" },
  startRoom: { label: "Start a room", href: "/app/rooms?new=1" },
  joinRoom: { label: "Join a room", href: "/rooms" },
  features: { label: "See everything it does", href: "/features" },
  safety: { label: "Read the safety rules", href: "/safety" },
} as const;

export const mockLabels = {
  tabClosed: "Browser closed",
  you: "You",
  typing: "typing",
  audio: "Audio",
  video: "Video",
  view: "Audio or video",
  notes: "Notes",
  close: "Close",
  raiseHand: "Raise hand",
  audioOnly: "Audio only",
  dataSaver: "Data saver on",
  mute: "Mute",
  camera: "Camera",
  end: "End",
  speaking: "Speaking",
  muted: "Muted",
  edited: "Edited",
  replyTo: "Replying to Ada",
  thisDevice: "This device",
  signOut: "Sign out",
  block: "Block",
  report: "Report",
  mod: "Moderator",
  host: "Host",
} as const;

export const featuresPage = {
  hero: {
    title: "Everything you need to gist, live.",
    lead: "Friends, chats, calls and rooms in one app. Audio comes first, video is there when you want it, and none of it eats your data for breakfast.",
  },
  rows: [
    {
      id: "chats",
      title: "Chat all you want, anytime",
      body: "Every message carries its time. Swipe to reply, tap to react, star what matters and delete what does not. Made a typo? You have 15 minutes to fix it.",
      points: [
        "Typing, delivered and read, with read receipts you can switch off",
        "Delete for yourself, or for everyone in the first hour",
        "Archive a chat and it stays archived",
      ],
      icon: "friends" as const,
      cta: { label: "Start a chat", href: "/signup" },
      visual: "chat",
    },
    {
      id: "calls",
      title: "Switch anytime",
      body: "Start a call on audio and turn your camera on in the middle of it, or drop the video and keep talking when data gets tight. No hanging up, no calling back.",
      points: [
        "Audio or video from any chat",
        "One tap to add or remove video",
        "Rings your phone even when the app is closed",
      ],
      icon: "voice" as const,
      cta: { label: "Call a friend", href: "/signup" },
      visual: "call",
    },
    {
      id: "rooms",
      title: "A room for every gist",
      body: "Start one on the spot or schedule it for later. Pick a topic and a language, go public or keep it private. Up to 32 people can join, and moderators keep it civil.",
      points: [
        "English, Pidgin, Yoruba, Igbo and Hausa tags",
        "Mute, remove, ban and lock from the moderator tools",
        "The host sees a log of every moderator action",
      ],
      icon: "open-gist" as const,
      cta: { label: "See live rooms", href: "/rooms" },
      visual: "room",
    },
    {
      id: "alerts",
      title: "Alerts that find you",
      body: "Turn alerts on once and calls, messages and friend requests reach you through the browser or installed app, even if you closed the tab last night.",
      points: [
        "Quiet hours for when you need peace",
        "Missed calls always show in your call log",
        "Per type switches for in-app, push and email",
      ],
      icon: "alerts" as const,
      cta: { label: "Get the app", href: "/install" },
      visual: "alerts",
    },
    {
      id: "data",
      title: "Built for Nigerian data",
      body: "Data saver is on by default. Calls start with audio, video is held at a lower quality, and photos are compressed on your phone before they upload.",
      points: [
        "Audio first on every call",
        "Weak network banner with a one tap switch to audio",
        "Messages queue offline and send when the network returns",
      ],
      icon: "speed" as const,
      cta: { label: "Enter Gistroom", href: "/signup" },
      visual: "data",
    },
  ],
  more: {
    title: "The small things that add up",
    items: [
      {
        title: "Friends first",
        icon: "friends" as const,
        body: "Nobody can message you out of the blue. Send a request, chat once it is accepted.",
      },
      {
        title: "Voice notes",
        icon: "voice" as const,
        body: "Hold to record up to five minutes, with a waveform and playback at 1x, 1.5x or 2x.",
      },
      {
        title: "Photos, video and files",
        icon: "media" as const,
        body: "Share images, video, PDF, Word, Excel and PowerPoint files, with a clean preview for each.",
      },
      {
        title: "Starred messages",
        icon: "starred" as const,
        body: "Star the things you want to find later and open them from one list.",
      },
      {
        title: "Block and report",
        icon: "shield-slash" as const,
        body: "Block anyone. They see the chat as unavailable and are never told why.",
      },
      {
        title: "Dark mode",
        icon: "theme" as const,
        body: "Light by default. Switch to dark, or let your device decide.",
      },
      {
        title: "No app store needed",
        icon: "install" as const,
        body: "Add Gistroom to your Home Screen or desktop straight from the browser. No big download.",
      },
      {
        title: "Works offline",
        icon: "offline" as const,
        body: "Open your recent chats without a network. New messages wait in the outbox.",
      },
    ],
  },
  facts: {
    title: "The settings behind the promise",
    lead: "These are real limits in the app today.",
    /** The numbers come from LIMITS on the page, so they can never drift from the app. */
    labels: {
      room: "people in a room",
      edit: "to edit a message",
      ring: "a call rings before it counts as missed",
      voice: "longest voice note",
    },
  },
  closing: {
    title: "Your people are waiting.",
    body: "Sign up with your email in a minute and find your friends by name.",
  },
} as const;

export const aboutPage = {
  hero: {
    title: "Nigerians have a lot to say. Gistroom gives it somewhere to go.",
    lead: "Gistroom is a place to talk about Nigeria out loud, built in Nigeria.",
  },
  story: {
    icon: "idea",
    title: "Why it exists",
    body: [
      "The best conversations in Nigeria happen out loud: under an umbrella, in a barbershop, on a rooftop, in a danfo. Most apps squeeze that into text, or burn through your data trying to carry it.",
      "Gistroom puts the voice first. Rooms are quick to start, calls work on weak networks, and the app is shaped around the way people here actually talk.",
    ],
  },
  principles: {
    title: "What we hold to",
    items: [
      {
        icon: "voice",
        title: "Audio first",
        body: "Voice is the default. Video is there when you want it and your network allows it.",
      },
      {
        icon: "friends",
        title: "Friends decide",
        body: "Private chats and calls only happen between people who accepted each other.",
      },
      {
        icon: "private",
        title: "Safe by design",
        body: "Block, report, moderators and private rooms are part of the product, not an afterthought.",
      },
      {
        icon: "honest",
        title: "Honest words",
        body: "We never claim to verify people we do not verify, and we never make up numbers, reviews or logos.",
      },
    ],
  },
  maker,
  tools: {
    icon: "tools",
    title: "Behind the scenes",
    lead: "Some of the tools that keep Gistroom running.",
    items: [
      { icon: "typescript", name: "TypeScript", role: "Types everywhere" },
      { icon: "nextdotjs", name: "Next.js", role: "The web app" },
      { icon: "react", name: "React", role: "The interface" },
      { icon: "tailwindcss", name: "Tailwind CSS", role: "The styling" },
      { icon: "nodedotjs", name: "Node.js", role: "The realtime service" },
      { icon: "socketdotio", name: "Socket.IO", role: "Live updates" },
      { icon: "livekit", name: "LiveKit", role: "Calls and rooms" },
      { icon: "postgresql", name: "PostgreSQL", role: "The database" },
      { icon: "prisma", name: "Prisma", role: "Talking to the data" },
      { icon: "supabase", name: "Supabase", role: "Database and storage" },
      { icon: "zod", name: "Zod", role: "Checking every input" },
      { icon: "vitest", name: "Vitest", role: "The tests" },
      { icon: "vercel", name: "Vercel", role: "Where the app lives" },
      { icon: "render", name: "Render", role: "Where realtime lives" },
      { icon: "express", name: "Express", role: "The realtime server" },
    ],
  },
  closing: {
    title: "Come and gist.",
    body: "Start a room, call a friend, or drop into a conversation already going on.",
  },
} as const;

export const securityPage = {
  hero: {
    title: "Your account and your conversations, kept safe.",
    lead: "What we do to protect you, in plain words. We also tell you what we do not do.",
  },
  pillars: [
    {
      id: "account",
      icon: "account",
      title: "Your account",
      points: [
        "A one time code confirms your email when you sign up",
        "Passwords are stored as salted hashes, never in plain text",
        "Wrong password and wrong code attempts are limited and locked",
        "We email you when your account signs in on a new device",
      ],
      visual: "devices",
    },
    {
      id: "devices",
      icon: "devices",
      title: "Your devices",
      points: [
        "See every device that is signed in",
        "Sign out one device or every other device in a tap",
        "Changing your password signs out everywhere else",
      ],
    },
    {
      id: "media",
      icon: "media",
      title: "Messages and media",
      points: [
        "Everything travels over HTTPS and secure web sockets",
        "Chat media sits in a private store and opens through short lived links",
        "Photos lose their location and camera details before upload",
        "Uploads are checked by their real file type, not just their name",
      ],
    },
    {
      id: "abuse",
      icon: "shield-slash",
      title: "Against abuse",
      points: [
        "Rate limits on sign in, search, friend requests and messages",
        "Every action is checked on the server, never only in the app",
        "Strict content security rules in the browser",
      ],
    },
  ],
  honest: {
    icon: "honest",
    title: "What we do not claim",
    body: "Gistroom does not use end to end encryption yet, so we do not describe it that way. We can read message data on our servers when we need to act on a report. Do not share anything you would not want a moderator to see in a report.",
    action: { label: "How safety works", href: "/safety" },
  },
  report: {
    icon: "report",
    title: "Found a problem?",
    body: "Write to security@gistroom.ng with what you found and how to repeat it. Please do not post it publicly first. We reply within three working days.",
    action: { label: "Email us", href: "mailto:security@gistroom.ng" },
  },
} as const;

export const safetyPage = {
  hero: {
    title: "Gistroom works when people feel safe to speak.",
    lead: "These are the rules, the tools you have, and how we respond when something goes wrong.",
  },
  guidelines: {
    title: "Community guidelines",
    items: [
      {
        title: "Be respectful",
        icon: "respect" as const,
        body: "Argue about ideas, not about who people are.",
      },
      {
        title: "No hate or threats",
        icon: "no-hate" as const,
        body: "No harassment, bullying or abuse of any kind.",
      },
      {
        title: "Keep it private",
        icon: "private" as const,
        body: "Do not share private information about other people.",
      },
      {
        title: "No scams",
        icon: "no-scams" as const,
        body: "No fraud, no impersonation, no tricking people out of money.",
      },
      {
        title: "Protect children",
        icon: "children" as const,
        body: "No sexual content involving anyone under 18, ever.",
      },
      {
        title: "Follow the law",
        icon: "law" as const,
        body: "The Cybercrimes Act applies to what you say and share here.",
      },
    ],
  },
  tools: {
    title: "The tools are in your hands",
    items: [
      {
        title: "Block",
        icon: "block" as const,
        body: "Block anyone from a profile, a chat, a call or a room. They see the chat as unavailable and are not told.",
      },
      {
        title: "Report",
        icon: "report" as const,
        body: "Report a person, a message, a room or a room message. We keep the last 20 messages as evidence.",
      },
      {
        title: "Invites",
        icon: "invites" as const,
        body: "Choose who can invite you to rooms: friends only, or everyone.",
      },
      {
        title: "Privacy",
        icon: "privacy" as const,
        body: "Turn off read receipts and presence whenever you like.",
      },
      {
        title: "Private rooms",
        icon: "private-room" as const,
        body: "Keep a room private and share the link only with people you trust.",
      },
    ],
  },
  how: {
    title: "What happens after you report",
    lead: "Four steps from the moment you tap report to the outcome landing back with you.",
    steps: [
      {
        title: "You report",
        icon: "report" as const,
        body: "Choose a reason and add details if you want. The other person is not told.",
      },
      {
        title: "We keep the evidence",
        icon: "starred" as const,
        body: "The recent messages are saved so we can see what happened.",
      },
      {
        title: "A person reviews it",
        icon: "respect" as const,
        body: "Someone on our team looks at it and decides what to do.",
      },
      {
        title: "We act and tell you",
        icon: "honest" as const,
        body: "We can warn, suspend or remove accounts, and we tell you the outcome.",
      },
    ],
  },
  moderators: {
    title: "Room moderators",
    body: "Hosts and moderators can mute, remove and ban people from their room, lock it and delete room chat. Every moderator action is logged where the host can see it.",
    action: { label: "Become a moderator", href: "/signup" },
  },
  contact: {
    title: "Abuse and takedown requests",
    body: "To report abusive content or ask us to take something down, write to safety@gistroom.ng. Tell us where it is and why it breaks the guidelines or the law.",
    action: { label: "Email safety@gistroom.ng", href: "mailto:safety@gistroom.ng" },
  },
} as const;

export const installPage = {
  hero: {
    title: "Put Gistroom on your Home Screen.",
    lead: "It installs from your browser. No app store, no big download, and you get alerts even when it is closed.",
  },
  platforms: [
    {
      id: "android",
      icon: "device-android",
      title: "Android",
      steps: [
        "Open Gistroom in Chrome",
        "Tap Install in the banner, or open the menu and choose Install app",
        "Open Gistroom from your Home Screen and turn on alerts",
      ],
    },
    {
      id: "ios",
      icon: "device-ios",
      title: "iPhone and iPad",
      note: "Add Gistroom to your Home Screen to get call and message alerts. Alerts only work from the installed app on iPhone.",
      steps: [
        "Open Gistroom in Safari",
        "Tap the Share button, then Add to Home Screen",
        "Open Gistroom from your Home Screen, then turn on alerts in Settings",
      ],
    },
    {
      id: "desktop",
      icon: "device-desktop",
      title: "Windows, Mac and Linux",
      steps: [
        "Open Gistroom in Chrome or Edge",
        "Click the install icon in the address bar",
        "Gistroom opens in its own window",
      ],
    },
  ],
  why: {
    title: "Why install it",
    items: [
      {
        icon: "alerts",
        title: "Alerts when it is closed",
        body: "Calls and messages reach you even if the tab is gone.",
      },
      {
        icon: "speed",
        title: "Opens faster",
        body: "Start from your Home Screen like any other app.",
      },
      {
        icon: "offline",
        title: "Works offline",
        body: "Read your recent chats without a network.",
      },
    ],
  },
  closing: { title: "Ready when you are.", body: "Open Gistroom, then install it from the menu." },
  action: "Install it now",
  iosAction: "Show me how",
  installed: "Installed on this device.",
  hintManual:
    "If nothing pops up, open your browser menu and choose Install, or follow the steps above.",
  hintIos: "iPhone installs from the Share sheet: follow the steps above.",
} as const;

export const roomsSearch = {
  hero: {
    title: "Find a room to join.",
    lead: "Search live and upcoming public rooms by title, topic or keyword.",
  },
  label: "Search rooms",
  placeholder: "Search rooms, like football, jollof or japa",
  clear: "Clear search",
  trySearching: "Popular keywords",
  keywords: [
    "football",
    "music",
    "politics",
    "tech",
    "campus",
    "japa",
    "owambe",
    "jollof",
    "relationships",
    "comedy",
  ],
  searching: "Searching rooms",
  results: (n: number) => (n === 1 ? "1 room found" : `${n} rooms found`),
  noResultsTitle: (q: string) => `No rooms match "${q}"`,
  noResultsBody: "Try another word, or start a room on this topic yourself.",
  sampleNote: "Rooms are listed as they happen. Nothing here is sample content.",
} as const;
