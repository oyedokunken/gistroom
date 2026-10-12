import { chat } from "@/content/chat";
import { formatRelative } from "./time";

export interface PresenceInfo {
  online: boolean;
  lastSeenAt: string | null;
}

/**
 * Status line under a name. Only shown when the socket told us something, which already respects both
 * people's privacy settings (Section 9.3b). Unknown means show nothing, never a guess.
 */
/** The socket's word wins. Before it speaks, the last seen time from the server stands in for it. */
export function presenceOf(
  live: PresenceInfo | undefined,
  lastSeenAt: string | null | undefined,
): PresenceInfo | undefined {
  if (live) return live;
  return lastSeenAt ? { online: false, lastSeenAt } : undefined;
}

export function presenceLabel(
  info: PresenceInfo | undefined,
  now: Date = new Date(),
): string | null {
  if (!info) return null;
  if (info.online) return chat.online;
  if (info.lastSeenAt) return chat.lastSeen(formatRelative(new Date(info.lastSeenAt), now));
  return chat.offlineStatus;
}
