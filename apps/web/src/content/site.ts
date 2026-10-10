export const site = {
  name: "Gistroom",
  tagline: "Come gist. Properly.",
  description:
    "Talk live about Nigeria. Start a room, call your friends and chat. Audio first, built for Nigerian data.",
  url: "https://gistroom.ng",
} as const;

export const home = {
  title: "Gistroom: come gist. Properly.",
} as const;

export const notFound = {
  title: "Page not found",
  code: "Error 404",
  heading: "This page is not here.",
  body: "Nobody is talking in this room. Head back home.",
  home: "Go home",
  rooms: "Browse live rooms",
  signedInHome: "Open your chats",
  flatline: "A flat sound wave with one small blip, because nobody is speaking here",
} as const;

export const serverError = {
  title: "Something broke",
  code: "Error 500",
  heading: "Gistroom hit a problem on our side.",
  body: "We are on it. Try again in a moment.",
  retry: "Try again",
  home: "Go home",
  reference: (digest: string) => `Reference ${digest}`,
} as const;

/** The only place the builder is named on the public site: one line in the footer. */
export const builderCredit = { text: "Built by Oyedokun Ken", href: "https://www.oyedokun.dev/" } as const;
