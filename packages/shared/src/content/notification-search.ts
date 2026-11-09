import type { NotificationType } from "../dto";

/**
 * Words a person might type to find a kind of notification. Matched as a lower case substring, so "missed" and
 * "call" both find missed calls. These are search keywords, kept next to the other shared copy (R10).
 */
export const notificationSearchAliases: Record<NotificationType, readonly string[]> = {
  FRIEND_REQUEST_RECEIVED: ["friend request", "friend requests", "request"],
  FRIEND_REQUEST_ACCEPTED: ["accepted request", "accepted requests", "friend accepted", "accepted"],
  DM_MESSAGE: ["message", "messages", "new message"],
  CALL_MISSED: ["missed call", "missed calls", "call", "calls"],
  ROOM_INVITE: ["room invite", "room invites", "invite", "invited"],
  ROOM_STARTING: ["room reminder", "room reminders", "reminder", "starting soon"],
  ROOM_LIVE_NOW: ["room is live", "live now", "live"],
  ROOM_DUE_HOST: ["room due", "due to start"],
  ROOM_RESCHEDULED: ["room rescheduled", "new time", "rescheduled"],
  ROOM_CANCELLED: ["room cancelled", "cancelled", "canceled"],
  ROOM_REGISTRATIONS: ["registrations", "registered"],
  ROOM_ROLE_CHANGED: ["room role", "role changed", "removed", "banned", "moderator"],
  ROOM_ENDED: ["room ended", "ended"],
  SECURITY_NEW_DEVICE: ["new sign in", "sign in", "security", "new device"],
  REPORT_UPDATE: ["report", "report update"],
  SYSTEM: ["gistroom notice", "notice"],
  REENGAGE: ["come gist", "reminder when away"],
  ACTIVITY: [],
};
