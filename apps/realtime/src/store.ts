import type {
  CallDto,
  CallMedia,
  CallStatus,
  FriendRequestDto,
  MessageDto,
  NotificationDto,
  NotificationPrefs,
  PublicUser,
} from "@gistroom/shared";

/** One stored push subscription. */
export interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failureCount: number;
}

export interface NotificationBundle {
  notification: NotificationDto;
  userId: string;
  timeZone: string;
  prefs: NotificationPrefs;
  unread: number;
  chatsUnread: number;
  subscriptions: PushSub[];
}

export interface CallDelivery {
  callId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  media: CallMedia;
  callerName: string;
  /** The call as each of the two people sees it. */
  dtoFor: Map<string, CallDto>;
  /** What the callee needs to be pushed when no tab is open. */
  calleePush: { subscriptions: PushSub[]; previews: boolean; unread: number };
}

export interface AckResult {
  moved: boolean;
  messageId: string;
  peerId: string;
  /** False when the person turned read receipts off, so the peer is not told about reads. */
  announceRead: boolean;
}

/**
 * Everything the realtime service needs from Postgres. The Prisma implementation lives in prisma-store.ts.
 * Tests pass an in memory implementation, so socket behavior is testable without a database.
 */
export interface Store {
  sessionValid(userId: string, sessionId: string): Promise<boolean>;
  /** Peer id when the person is in the conversation, friends with the peer and neither has blocked the other. */
  interactablePeer(userId: string, conversationId: string): Promise<string | null>;
  friendIds(userId: string): Promise<string[]>;
  /** User.showPresence for each id. Missing ids count as off. */
  presenceSettings(userIds: string[]): Promise<Map<string, boolean>>;
  markLastSeen(userId: string, at: Date): Promise<void>;
  ack(input: {
    userId: string;
    conversationId: string;
    messageId: string;
    kind: "delivered" | "read";
  }): Promise<AckResult | null>;

  messageForDelivery(
    messageId: string,
  ): Promise<{ conversationId: string; byUser: Map<string, MessageDto> } | null>;
  receiptTarget(conversationId: string, userId: string): Promise<string | null>;
  friendRequestForDelivery(requestId: string): Promise<{
    requesterId: string;
    addresseeId: string;
    dtoForAddressee: FriendRequestDto;
    requester: PublicUser;
    addressee: PublicUser;
    conversationId: string | null;
  } | null>;
  counts(userId: string): Promise<{ notifications: number; chats: number }>;

  callForDelivery(callId: string): Promise<CallDelivery | null>;
  notificationBundle(notificationId: string): Promise<NotificationBundle | null>;
  recordPushResult(input: { subscriptionId: string; ok: boolean; revoke: boolean }): Promise<void>;

  /** Jobs that are due and not yet claimed. */
  dueJobs(now: Date, limit: number): Promise<{ id: string; kind: string; payload: unknown }[]>;
  /** True only for the caller that wins the claim, so a job runs once even with two claimers. */
  claimJob(id: string): Promise<boolean>;
  claimJobsForNotification(notificationId: string): Promise<string[]>;
}
