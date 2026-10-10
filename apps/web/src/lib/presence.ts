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
export function presenceLabel(
  info: PresenceInfo | undefined,
  now: Date = new Date(),
): string | null {
  if (!info) return null;
  if (info.online) return chat.online;
  if (info.lastSeenAt) return chat.lastSeen(formatRelative(new Date(info.lastSeenAt), now));
  return chat.offlineStatus;
}
