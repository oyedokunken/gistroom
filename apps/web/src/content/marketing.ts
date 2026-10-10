/**
 * Copy for the designed public pages (R10). Every number here is a real product setting, not a claim about
 * users. Sample names in the device mocks are labeled as sample on the page.
 */

export const cta = {
  enter: { label: "Enter Gistroom", href: "/signup" },
  rooms: { label: "See live rooms", href: "/rooms" },
  features: { label: "See everything it does", href: "/features" },
  safety: { label: "Read the safety rules", href: "/safety" },
} as const;

export const mockLabels = {
  sample: "Sample conversation",
  sampleRoom: "Sample room",
  sampleAlerts: "Sample alerts",
  sampleDevices: "Sample devices",
  you: "You",
  typing: "typing",
  audio: "Audio",
  video: "Video",
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
      title: "Chats that feel right",
      body: "Bubbles with the time on every message. Swipe a message to reply, tap it to react, star it or delete it. Made a typo? Edit it for 15 minutes after you send it.",
      points: [
        "Typing, delivered and read, with read receipts you can switch off",
        "Delete for yourself, or for everyone in the first hour",
        "Archive a chat and it stays archived",
      ],
      visual: "chat",
    },
    {
      id: "calls",
      title: "Calls that switch",
      body: "Call a friend with audio and turn on your camera in the middle, no hanging up. If the network gets weak, Gistroom offers to drop to audio so the talk keeps going.",
      points: [
        "Audio or video from any chat",
        "One tap to add or remove video",
        "Rings your phone even when the app is closed",
      ],
      visual: "call",
    },
    {
      id: "rooms",
      title: "Rooms for the whole conversation",
      body: "Start a room on the spot or schedule one. Pick a topic and a language, then keep it public or private. Up to 32 people can join, and moderators keep it civil.",
      points: [
        "English, Pidgin, Yoruba, Igbo and Hausa tags",
        "Mute, remove, ban and lock from the moderator tools",
        "The host sees a log of every moderator action",
      ],
      visual: "room",
    },
    {
      id: "alerts",
      title: "Alerts that find you",
      body: "Turn alerts on once and calls, messages and friend requests reach you through your browser or installed app, even if you closed the tab last night.",
      points: [
        "Quiet hours for when you need peace",
        "Missed calls always show in your call log",
        "Per type switches for in-app, push and email",
      ],
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
      visual: "data",
    },
  ],
  more: {
    title: "And the small things that add up",
    items: [
      {
        title: "Friends first",
        body: "Nobody can message you out of the blue. Send a request, chat once it is accepted.",
      },
      {
        title: "Voice notes",
        body: "Hold to record up to five minutes, with a waveform and playback at 1x, 1.5x or 2x.",
      },
      {
        title: "Photos, video and files",
        body: "Share images, video, PDF, Word, Excel and PowerPoint files, with a clean preview for each.",
      },
      {
        title: "Starred messages",
        body: "Star the things you want to find later and open them from one list.",
      },
      {
        title: "Block and report",
        body: "Block anyone. They see the chat as unavailable and are never told why.",
      },
      { title: "Dark mode", body: "Light by default. Switch to dark, or let your device decide." },
      {
        title: "Install it",
        body: "Add Gistroom to your Home Screen or desktop. No app store, no big download.",
      },
      {
        title: "Works offline",
        body: "Open your recent chats without a network. New messages wait in the outbox.",
      },
    ],
  },
  facts: {
    title: "The settings behind the promise",
    lead: "These are real limits in the app today.",
    items: [
      { value: "32", label: "people in a room" },
      { value: "15 min", label: "to edit a message" },
      { value: "45 sec", label: "a call rings before it counts as missed" },
      { value: "5 min", label: "longest voice note" },
    ],
  },
  closing: {
    title: "Your people are waiting.",
    body: "Sign up with your email in a minute and find your friends by name.",
  },
} as const;

export const aboutPage = {
  hero: {
    title: "Nigerians have a lot to say. Gistroom gives it somewhere to go.",
    lead: "Gistroom is a place to talk about Nigeria out loud, built in Nigeria by @oyedokunken.",
  },
  story: {
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
        title: "Audio first",
        body: "Voice is the default. Video is there when you want it and your network allows it.",
      },
      {
        title: "Friends decide",
        body: "Private chats and calls only happen between people who accepted each other.",
      },
      {
        title: "Safe by design",
        body: "Block, report, moderators and private rooms are part of the product, not an afterthought.",
      },
      {
        title: "Honest words",
        body: "We never claim to verify people we do not verify, and we never make up numbers, reviews or logos.",
      },
    ],
  },
  maker: {
    title: "Who makes it",
    body: "Gistroom is built by @oyedokunken, one developer who wanted this to exist. You can see the rest of the work at oyedokun.dev.",
    link: { label: "Visit oyedokun.dev", href: "https://www.oyedokun.dev/" },
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
      title: "Your devices",
      points: [
        "See every device that is signed in",
        "Sign out one device or every other device in a tap",
        "Changing your password signs out everywhere else",
      ],
    },
    {
      id: "media",
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
      title: "Against abuse",
      points: [
        "Rate limits on sign in, search, friend requests and messages",
        "Every action is checked on the server, never only in the app",
        "Strict content security rules in the browser",
      ],
    },
  ],
  honest: {
    title: "What we do not claim",
    body: "Gistroom does not use end to end encryption yet, so we do not describe it that way. We can read message data on our servers when we need to act on a report. Do not share anything you would not want a moderator to see in a report.",
  },
  report: {
    title: "Found a problem?",
    body: "Write to security@gistroom.ng with what you found and how to repeat it. Please do not post it publicly first. We reply within three working days.",
    action: { label: "Email security@gistroom.ng", href: "mailto:security@gistroom.ng" },
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
      { title: "Be respectful", body: "Argue about ideas, not about who people are." },
      { title: "No hate or threats", body: "No harassment, bullying or abuse of any kind." },
      { title: "Keep it private", body: "Do not share private information about other people." },
      { title: "No scams", body: "No fraud, no impersonation, no tricking people out of money." },
      { title: "Protect children", body: "No sexual content involving anyone under 18, ever." },
      {
        title: "Follow the law",
        body: "The Cybercrimes Act applies to what you say and share here.",
      },
    ],
  },
  tools: {
    title: "The tools are in your hands",
    items: [
      {
        title: "Block",
        body: "Block anyone from a profile, a chat, a call or a room. They see the chat as unavailable and are not told.",
      },
      {
        title: "Report",
        body: "Report a person, a message, a room or a room message. We keep the last 20 messages as evidence.",
      },
      { title: "Invites", body: "Choose who can invite you to rooms: friends only, or everyone." },
      { title: "Privacy", body: "Turn off read receipts and presence whenever you like." },
      {
        title: "Private rooms",
        body: "Keep a room private and share the link only with people you trust.",
      },
    ],
  },
  how: {
    title: "What happens after you report",
    steps: [
      {
        title: "You report",
        body: "Choose a reason and add details if you want. The other person is not told.",
      },
      {
        title: "We keep the evidence",
        body: "The recent messages are saved so we can see what happened.",
      },
      {
        title: "A person reviews it",
        body: "Someone on our team looks at it and decides what to do.",
      },
      {
        title: "We act and tell you",
        body: "We can warn, suspend or remove accounts, and we tell you the outcome.",
      },
    ],
  },
  moderators: {
    title: "Room moderators",
    body: "Hosts and moderators can mute, remove and ban people from their room, lock it and delete room chat. Every moderator action is logged where the host can see it.",
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
      title: "Android",
      steps: [
        "Open Gistroom in Chrome",
        "Tap Install in the banner, or open the menu and choose Install app",
        "Open Gistroom from your Home Screen and turn on alerts",
      ],
    },
    {
      id: "ios",
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
        title: "Alerts when it is closed",
        body: "Calls and messages reach you even if the tab is gone.",
      },
      { title: "Opens faster", body: "Start from your Home Screen like any other app." },
      { title: "Works offline", body: "Read your recent chats without a network." },
    ],
  },
  closing: { title: "Ready when you are.", body: "Open Gistroom, then install it from the menu." },
} as const;
