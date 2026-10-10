export const nav = {
  label: "Main",
  items: [
    { id: "features", label: "Features", href: "/features" },
    { id: "rooms", label: "Rooms", href: "/rooms" },
    { id: "safety", label: "Safety", href: "/safety" },
    { id: "about", label: "About", href: "/about" },
  ],
  cta: { label: "Enter Gistroom", href: "/login" },
  home: "Gistroom home",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  more: "More",
  moreTitle: "More from Gistroom",
  moreItems: [
    { label: "Support", href: "/support" },
    { label: "Install the app", href: "/install" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
  liveNow: (count: number) => `Live now: ${count} ${count === 1 ? "room" : "rooms"}`,
} as const;

export const hero = {
  headline: "Come gist. Properly.",
  subhead:
    "Start a room, call your friends, or drop into a conversation already going on. Audio first, video when you want it, built for Nigerian data and Nigerian opinions.",
  primary: { label: "Enter Gistroom", href: "/login" },
  secondary: { label: "See live rooms", href: "/rooms" },
  stageLabel: "Friends gisting on a rooftop",
  // Short lines of sample gist that drift through the hero. They are decoration, not real messages.
  gist: [
    "Who is watching the match tonight?",
    "Abeg, run that story again.",
    "Oya, join the room.",
    "No wahala, I dey hear you.",
    "Wetin you think about the new price?",
    "How far, everybody?",
  ],
} as const;

export const footer = {
  label: "Footer",
  wordmark: "gistroom",
  columns: [
    {
      title: "Product",
      links: [
        { label: "Features", href: "/features" },
        { label: "Live rooms", href: "/rooms" },
        { label: "Install the app", href: "/install" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Security", href: "/security" },
        { label: "Changelog", href: "/changelog" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Cookies", href: "/cookies" },
        { label: "Acceptable use", href: "/acceptable-use" },
      ],
    },
    {
      title: "Help",
      links: [
        { label: "Support", href: "/support" },
        { label: "Safety", href: "/safety" },
      ],
    },
  ],
  madeIn: "Made in Nigeria",
  smallPrint: "Gistroom is built by Rexta Technologies.",
  followTitle: "Follow",
  scrollTop: "Back to top",
} as const;

export const social = [
  { label: "Instagram", url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
  { label: "X", url: process.env.NEXT_PUBLIC_SOCIAL_X },
  { label: "TikTok", url: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK },
  { label: "YouTube", url: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
].filter((s): s is { label: string; url: string } => Boolean(s.url));
