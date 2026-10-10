/** Copy for the landing page sections (R10). No invented numbers, quotes or logos. Sample content is labeled as sample. */
export const homeCopy = {
  topics: {
    title: "Pick a topic, find your gist",
    lead: "Rooms are tagged by topic and language, so the right people find each other.",
    all: "See all live rooms",
    label: "Topics",
  },
  how: {
    title: "Four steps to your first gist",
    lead: "From your email to your first room. That is all it takes.",
    steps: [
      {
        title: "Get your code",
        body: "Sign up with your email and confirm it with a six digit code. You do it once.",
      },
      {
        title: "Find your people",
        body: "Search friends by name or username and send a request. Chat starts when they accept.",
      },
      {
        title: "Start or join a room",
        body: "Open a room on the spot, or drop into one that is already going on.",
      },
      {
        title: "Keep gisting in chat",
        body: "Voice notes, photos, replies and reactions, whenever you like.",
      },
    ],
    stepLabel: (n: number, total: number) => `Step ${n} of ${total}`,
  },
  tryRoom: {
    title: "Try a room, right here",
    lead: "Tap a person to unmute them, raise your hand, switch between audio and video or send a reaction. It is only a demo, nothing is recorded.",
    sample: "Sample room, nothing here is live",
    unmute: (name: string) => `Unmute ${name}`,
    mute: (name: string) => `Mute ${name}`,
    raise: "Raise hand",
    lower: "Lower hand",
    audio: "Audio",
    video: "Video",
    view: "Room view",
    react: "Send a reaction",
    live: "Live",
  },
  calls: {
    title: "Switch anytime",
    lead: "Start on audio, turn the camera on mid-call, or drop back to audio when data gets tight. No hanging up, no calling back.",
    points: [
      "Audio first on every call",
      "Add or remove video any time",
      "Weak network? One tap back to audio",
    ],
  },
  alerts: {
    title: "Get notified, every time",
    lead: "Turn alerts on once. Calls, messages and friend requests reach you even when the browser is closed.",
    promise: "You get them even if you closed the tab last night.",
    points: [
      "Calls ring on your phone with Answer and Decline",
      "Messages and friend requests arrive as they happen",
      "Quiet hours when you need peace",
    ],
  },
  everywhere: {
    title: "Gist happens everywhere",
    lead: "At the danfo stop, the viewing centre, the suya stand and on the rooftop. Gistroom is where the conversation goes when you cannot be there.",
    progress: (n: number, total: number) => `${n} of ${total}`,
    chapters: [
      {
        id: "scene-danfo",
        time: "Morning",
        title: "Gist at the danfo stop",
        body: "Last night's match, this week's fuel price, whatever the conductor is shouting about. Hop in a room before you hop in the bus.",
        alt: "A yellow danfo bus with its conductor waving, and three people chatting on their phones beside it",
      },
      {
        id: "scene-football-centre",
        time: "Afternoon",
        title: "Gist at the viewing centre",
        body: "The whole centre erupts at once. With a room, the people who could not come erupt with you.",
        alt: "Fans packed under a shed cheering at a big screen showing a match",
      },
      {
        id: "scene-suya",
        time: "Evening",
        title: "Gist at the suya stand",
        body: "Pepper, onions, opinions. Pull up a stool, and let your friends on the other side of town pull up too.",
        alt: "A suya seller grilling skewers over glowing coals while two customers chat under a lantern",
      },
      {
        id: "scene-rooftop",
        time: "Night",
        title: "Gist on the rooftop",
        body: "Music low, lights on, the city below. The late night talks are the best ones.",
        alt: "Four friends on a rooftop at night with a speaker, string lights and the city behind them",
      },
    ],
  },
  discover: {
    title: "Live right now",
    lead: "Public rooms happening now and the ones coming up. Search or tap a keyword.",
  },
  chat: {
    title: "Chat, properly",
    lead: "Everything you expect from a good chat, with the time on every message.",
    voice: {
      title: "Voice notes",
      body: "Hold to record, see the waveform, play at 1x, 1.5x or 2x.",
    },
    media: { title: "Photos, video and files", body: "A clean preview for every kind of file." },
    starred: { title: "Starred", body: "Keep the messages you want to find again." },
    reactions: { title: "Reactions", body: "Both of you can react to the same message." },
    bubbles: {
      title: "Time on every message",
      body: "In your own time zone, with delivered and read ticks.",
    },
    starredSample: "Meet at 7, bring the jollof.",
    fileName: "Match day plan.pdf",
    fileMeta: "PDF, 240 KB",
  },
  safe: {
    title: "Safe by design",
    lead: "You choose who can reach you, and the people running a room have real tools.",
    points: [
      {
        icon: "private-room",
        title: "Private rooms",
        body: "Only people you invite, or who open your invite link, can enter.",
      },
      {
        icon: "shield-slash",
        title: "Moderators",
        body: "Mute, remove, ban, lock the room and delete chat. Every action is logged for the host.",
      },
      {
        icon: "report",
        title: "Block and report",
        body: "Block anyone in one tap. Report with the last 20 messages kept as evidence.",
      },
    ],
    more: "Read the safety rules",
  },
  data: {
    title: "Built for Nigerian data",
    lead: "Audio comes first, video is held to a lower quality and photos are squeezed on your phone before they upload. Slide the network and watch the call adapt.",
    sliderLabel: "Network strength",
    levels: [
      { value: "4", label: "Strong" },
      { value: "3", label: "Okay" },
      { value: "2", label: "Weak" },
      { value: "1", label: "Very weak" },
    ],
    strong: "Video call, data saver on.",
    weak: "Audio only, so the talk keeps going.",
  },
  faq: { title: "Questions people ask" },
  final: {
    title: "Come and gist.",
    body: "Start a room, call a friend, or drop into a conversation already going on.",
  },
} as const;
