import { fab } from "@/content/fab";
import type { FabConfig, FabPlace } from "@/lib/fab";

/** The actions for each place. Calls and friends open small windows, the rest go to a page. */
export const FAB_CONFIG: Record<FabPlace, FabConfig> = {
  chats: {
    place: "chats",
    actions: [
      {
        id: "new",
        label: fab.actions.newChat,
        icon: "chat",
        kind: { type: "href", href: "/app/friends" },
      },
      {
        id: "find",
        label: fab.actions.findFriends,
        icon: "search",
        kind: { type: "href", href: "/app/friends?tab=find" },
      },
    ],
  },
  calls: {
    place: "calls",
    actions: [
      {
        id: "audio",
        label: fab.actions.audioCall,
        icon: "phone",
        kind: { type: "modal", modal: "call-audio" },
      },
      {
        id: "video",
        label: fab.actions.videoCall,
        icon: "video",
        kind: { type: "modal", modal: "call-video" },
      },
    ],
  },
  friends: {
    place: "friends",
    actions: [
      {
        id: "add",
        label: fab.actions.addFriend,
        icon: "user-plus",
        kind: { type: "modal", modal: "add-friend" },
      },
      {
        id: "find",
        label: fab.actions.findNewFriends,
        icon: "compass",
        kind: { type: "href", href: "/app/discover" },
      },
    ],
  },
  rooms: {
    place: "rooms",
    actions: [
      {
        id: "create",
        label: fab.actions.createRoom,
        icon: "mic",
        kind: { type: "href", href: "/app/rooms?new=1" },
      },
      {
        id: "join",
        label: fab.actions.joinRoom,
        icon: "link",
        kind: { type: "modal", modal: "join-room" },
      },
    ],
  },
  discover: { place: "discover", actions: [] },
};

/** The glyph for each place, from /images/fab. */
export const FAB_ICON: Record<FabPlace, string> = {
  chats: "/images/fab/chat.png",
  calls: "/images/fab/call.png",
  friends: "/images/fab/friends.png",
  rooms: "/images/fab/room.png",
  discover: "/images/fab/discover.png",
};

/** Pull the room code and invite out of a pasted link, or accept a bare code. Returns the app path to open. */
export function roomPathFrom(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const code = /^[A-Za-z0-9_-]{6,40}$/;
  if (code.test(text)) return `/app/rooms/${text}`;
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    const match = /^\/(?:app\/)?rooms\/([A-Za-z0-9_-]{6,40})\/?$/.exec(url.pathname);
    if (!match?.[1]) return null;
    const invite = url.searchParams.get("invite");
    return `/app/rooms/${match[1]}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`;
  } catch {
    return null;
  }
}
