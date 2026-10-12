import type { Language } from "./limits";
import type { PublicUser } from "./profile";

export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "VOICE" | "FILE" | "ROOM_INVITE" | "SYSTEM";

export interface AttachmentDto {
  id: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveform: number[];
  /** Fetched through /api/media/{id}, which authorizes and redirects to a short lived signed URL. */
  hasThumb: boolean;
}

export interface ReactionDto {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  clientId: string;
  type: MessageType;
  /** Null once deleted for everyone. */
  body: string | null;
  replyToId: string | null;
  replyPreview: { id: string; senderId: string; body: string | null; type: MessageType } | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  deletedForEveryone: boolean;
  /** Set when the sender edited the text inside the edit window. */
  editedAt: string | null;
  attachments: AttachmentDto[];
  reactions: ReactionDto[];
  starred: boolean;
}

/**
 * OK: chat as normal. BLOCKED_BY_ME: you blocked them, you can unblock. UNAVAILABLE: they blocked you or the
 * account is gone; the chat just shows as unavailable and never says why.
 */
export type ChatAvailability = "OK" | "BLOCKED_BY_ME" | "UNAVAILABLE";

export interface ConversationDto {
  id: string;
  peer: PublicUser;
  lastMessage: MessageDto | null;
  lastMessageAt: string | null;
  unread: number;
  archived: boolean;
  muted: boolean;
  availability: ChatAvailability;
  /**
   * When the other person was last on, from the database. Null when either of you hides presence.
   * It fills the gap before the socket tells us who is online right now.
   */
  peerLastSeenAt?: string | null;
}

export type FriendRequestDirection = "INCOMING" | "OUTGOING";

export interface FriendRequestDto {
  id: string;
  direction: FriendRequestDirection;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  user: PublicUser;
}

export interface FriendDto {
  user: PublicUser;
  conversationId: string | null;
  since: string;
  /** Null when the friend hides presence or the viewer does. */
  online: boolean | null;
  lastSeenAt: string | null;
}

export type NotificationType =
  | "FRIEND_REQUEST_RECEIVED"
  | "FRIEND_REQUEST_ACCEPTED"
  | "DM_MESSAGE"
  | "CALL_MISSED"
  | "ROOM_INVITE"
  | "ROOM_STARTING"
  | "ROOM_ROLE_CHANGED"
  | "ROOM_ENDED"
  | "SECURITY_NEW_DEVICE"
  | "REPORT_UPDATE"
  | "SYSTEM"
  /** A receipt for something the person did. Lives in the Activity tab, never pushed or emailed, expires after a week. */
  | "ACTIVITY";

export interface NotificationDto {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  /** In app path the notification opens. Always inside the app. */
  href: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PublicRoomCard {
  slug: string;
  title: string;
  description: string | null;
  topicSlug: string | null;
  topicName: string | null;
  language: Language;
  status: "LIVE" | "SCHEDULED";
  scheduledFor: string | null;
  startedAt: string | null;
  host: PublicUser;
  /** People currently in the room. */
  listeners: number;
  /** What the room is about. A label only, anyone can turn their camera on or off inside. */
  media: "AUDIO" | "VIDEO";
  /** A few of the people inside, for the avatar stack. */
  people: PublicUser[];
}
