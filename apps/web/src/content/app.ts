export const appNav = {
  label: "App",
  mobileLabel: "App tabs",
  items: [
    { id: "chats", label: "Chats", href: "/app/chats" },
    { id: "rooms", label: "Rooms", href: "/app/rooms" },
    { id: "calls", label: "Calls", href: "/app/calls" },
    { id: "friends", label: "Friends", href: "/app/friends" },
    { id: "notifications", label: "Alerts", href: "/app/notifications" },
    { id: "settings", label: "Settings", href: "/app/settings" },
  ],
  admin: { id: "admin", label: "Admin", href: "/app/admin" },
  notificationsAria: (count: number) =>
    count > 0 ? `Notifications, ${count} unread` : "Notifications",
  welcome: "You are in. Find your people.",
  welcomeTitle: "Welcome to Gistroom",
  signOut: "Sign out",
  signingOut: "Signing out",
  signOutConfirm: "Sign out of Gistroom on this device?",
  signOutTitle: "Sign out",
} as const;

export const pages = {
  rooms: {
    title: "Rooms",
    emptyTitle: "No live rooms yet",
    emptyBody: "Start one and call your people.",
  },
  calls: {
    title: "Calls",
    emptyTitle: "No calls yet",
    emptyBody: "Call a friend from their chat or profile.",
  },
  notifications: {
    title: "Notifications",
    empty: "Nothing new. We will tell you when something happens.",
  },
} as const;

export const settings = {
  title: "Settings",
  metaTitle: "Settings",
  back: "Back to settings",
  sections: [
    {
      id: "profile",
      label: "Profile",
      description: "Your name, bio and photo",
      href: "/app/settings/profile",
    },
    {
      id: "privacy",
      label: "Privacy",
      description: "Who can find and see you",
      href: "/app/settings/privacy",
    },
    {
      id: "devices",
      label: "Devices",
      description: "Where you are signed in",
      href: "/app/settings/devices",
    },
    {
      id: "appearance",
      label: "Appearance",
      description: "Light, dark or system",
      href: "/app/settings/appearance",
    },
    {
      id: "data",
      label: "Data saver",
      description: "Use less data on calls and media",
      href: "/app/settings/data",
    },
  ],
  profile: {
    heading: "Profile",
    nameLabel: "Name",
    bioLabel: "Bio",
    bioHelp: "Up to 160 characters. Friends and search results show this.",
    usernameLabel: "Username",
    usernameHelp: "Your username cannot be changed.",
    emailLabel: "Email",
    emailHelp: "Only you can see this.",
    save: "Save changes",
    saving: "Saving",
    saved: "Your profile is updated.",
  },
  privacy: {
    heading: "Privacy",
    discoverable: "Show me in search",
    discoverableHelp: "Turn this off and people cannot find you by name or username.",
    showPresence: "Show when I am online",
    showPresenceHelp: "You only see friends' status if yours is on too.",
    sendReadReceipts: "Send read receipts",
    sendReadReceiptsHelp: "Friends see when you have read their messages.",
    roomInvitesLabel: "Who can invite me to rooms",
    roomInvitesFriends: "Friends only",
    roomInvitesEveryone: "Everyone",
    save: "Save privacy settings",
    saving: "Saving",
    saved: "Your privacy settings are updated.",
  },
  devices: {
    heading: "Devices",
    intro: "These are the devices signed in to your account.",
    current: "This device",
    lastSeen: (when: string) => `Last active ${when}`,
    signOut: "Sign out this device",
    signOutOthers: "Sign out everywhere else",
    confirmOne: "This device will be signed out right away.",
    confirmOthers: "Every device except this one will be signed out.",
    confirmTitle: "Sign out",
    done: "Done. The device is signed out.",
    doneOthers: (n: number) =>
      n === 0
        ? "No other devices were signed in."
        : `Signed out ${n} other ${n === 1 ? "device" : "devices"}.`,
    empty: "No other devices.",
  },
  appearance: {
    heading: "Appearance",
    intro: "Light is the default. Choose dark, or follow your device.",
  },
  data: {
    heading: "Data saver",
    toggle: "Data saver",
    help: "Calls start with audio only and video is capped at a lower quality. Good for mobile data.",
    save: "Save",
    saving: "Saving",
    saved: "Data saver setting saved.",
  },
} as const;
