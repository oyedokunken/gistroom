import type {
  MessageDto,
  NotificationDto,
  NotificationPrefs,
  PublicUser,
} from "../../packages/shared/src";
import { defaultPrefs } from "../../packages/shared/src";
import type { AckResult, NotificationBundle, PushSub, Store } from "../../apps/realtime/src/store";

export interface FakeUser {
  id: string;
  showPresence: boolean;
  sendReadReceipts: boolean;
  timeZone: string;
}

/** In memory Store for the socket tests. Behaves like the Prisma store on the cases the tests care about. */
export class FakeStore implements Store {
  users = new Map<string, FakeUser>();
  validSessions = new Set<string>(); // `${userId}:${sessionId}`
  friends = new Map<string, Set<string>>();
  blocked = new Set<string>(); // `${a}>${b}`
  conversations = new Map<string, [string, string]>();
  acks: { userId: string; conversationId: string; messageId: string; kind: string }[] = [];
  cursor = new Map<string, number>(); // `${userId}:${conversationId}:${kind}` -> highest message number acked
  messages = new Map<string, { conversationId: string; n: number }>();
  notifications = new Map<string, NotificationBundle>();
  jobs = new Map<
    string,
    { id: string; kind: string; payload: unknown; processedAt: Date | null; dueAt: Date }
  >();
  pushResults: { subscriptionId: string; ok: boolean; revoke: boolean }[] = [];
  lastSeen = new Map<string, Date>();
  counts_ = { notifications: 0, chats: 0 };

  addUser(id: string, patch: Partial<FakeUser> = {}): this {
    this.users.set(id, {
      id,
      showPresence: true,
      sendReadReceipts: true,
      timeZone: "Africa/Lagos",
      ...patch,
    });
    return this;
  }
  addSession(userId: string, sessionId: string): this {
    this.validSessions.add(`${userId}:${sessionId}`);
    return this;
  }
  befriend(a: string, b: string): this {
    (this.friends.get(a) ?? this.friends.set(a, new Set()).get(a)!).add(b);
    (this.friends.get(b) ?? this.friends.set(b, new Set()).get(b)!).add(a);
    return this;
  }
  addConversation(id: string, a: string, b: string): this {
    this.conversations.set(id, [a, b]);
    return this;
  }
  addMessage(id: string, conversationId: string, n: number): this {
    this.messages.set(id, { conversationId, n });
    return this;
  }
  addNotification(
    bundle: Partial<NotificationBundle> & { notification: NotificationDto; userId: string },
  ): this {
    const full: NotificationBundle = {
      timeZone: "Africa/Lagos",
      prefs: defaultPrefs as NotificationPrefs,
      unread: 1,
      chatsUnread: 0,
      subscriptions: [],
      ...bundle,
    };
    this.notifications.set(bundle.notification.id, full);
    return this;
  }
  addJob(id: string, notificationId: string, dueAt = new Date(0)): this {
    this.jobs.set(id, {
      id,
      kind: "notify",
      payload: { notificationId },
      processedAt: null,
      dueAt,
    });
    return this;
  }

  async sessionValid(userId: string, sessionId: string) {
    return this.validSessions.has(`${userId}:${sessionId}`);
  }
  async interactablePeer(userId: string, conversationId: string) {
    const pair = this.conversations.get(conversationId);
    if (!pair || !pair.includes(userId)) return null;
    const peer = pair[0] === userId ? pair[1] : pair[0];
    if (!this.friends.get(userId)?.has(peer)) return null;
    if (this.blocked.has(`${userId}>${peer}`) || this.blocked.has(`${peer}>${userId}`)) return null;
    return peer;
  }
  async friendIds(userId: string) {
    return [...(this.friends.get(userId) ?? [])];
  }
  async presenceSettings(ids: string[]) {
    return new Map(
      ids.filter((i) => this.users.has(i)).map((i) => [i, this.users.get(i)!.showPresence]),
    );
  }
  async markLastSeen(userId: string, at: Date) {
    this.lastSeen.set(userId, at);
  }
  async ack(input: {
    userId: string;
    conversationId: string;
    messageId: string;
    kind: "delivered" | "read";
  }): Promise<AckResult | null> {
    const pair = this.conversations.get(input.conversationId);
    const msg = this.messages.get(input.messageId);
    if (
      !pair ||
      !pair.includes(input.userId) ||
      !msg ||
      msg.conversationId !== input.conversationId
    )
      return null;
    this.acks.push(input);
    const key = `${input.userId}:${input.conversationId}:${input.kind}`;
    const prev = this.cursor.get(key) ?? 0;
    const moved = msg.n > prev;
    if (moved) this.cursor.set(key, msg.n);
    return {
      moved,
      messageId: input.messageId,
      peerId: pair[0] === input.userId ? pair[1] : pair[0],
      announceRead: this.users.get(input.userId)?.sendReadReceipts ?? true,
    };
  }
  async messageForDelivery(messageId: string) {
    const msg = this.messages.get(messageId);
    const pair = msg ? this.conversations.get(msg.conversationId) : undefined;
    if (!msg || !pair) return null;
    const dto = (viewer: string): MessageDto => ({
      id: messageId,
      conversationId: msg.conversationId,
      senderId: pair[0],
      clientId: "c",
      type: "TEXT",
      body: `hello ${viewer}`,
      replyToId: null,
      replyPreview: null,
      meta: null,
      createdAt: new Date().toISOString(),
      deletedForEveryone: false,
      editedAt: null,
      attachments: [],
      reactions: [],
      starred: false,
    });
    return { conversationId: msg.conversationId, byUser: new Map(pair.map((u) => [u, dto(u)])) };
  }
  async receiptTarget(conversationId: string, userId: string) {
    const pair = this.conversations.get(conversationId);
    if (!pair || !pair.includes(userId)) return null;
    return pair[0] === userId ? pair[1] : pair[0];
  }
  async friendRequestForDelivery(): Promise<null> {
    return null;
  }
  async counts() {
    return this.counts_;
  }
  async roomForDelivery(): Promise<null> {
    return null;
  }
  async callForDelivery(): Promise<null> {
    return null;
  }
  async notificationBundle(id: string) {
    return this.notifications.get(id) ?? null;
  }
  async recordPushResult(r: { subscriptionId: string; ok: boolean; revoke: boolean }) {
    this.pushResults.push(r);
  }
  async dueJobs(now: Date, limit: number) {
    return [...this.jobs.values()].filter((j) => !j.processedAt && j.dueAt <= now).slice(0, limit);
  }
  async claimJob(id: string) {
    const j = this.jobs.get(id);
    if (!j || j.processedAt) return false;
    j.processedAt = new Date();
    return true;
  }
  async claimJobsForNotification(notificationId: string) {
    const claimed: string[] = [];
    for (const j of this.jobs.values()) {
      if (
        !j.processedAt &&
        (j.payload as { notificationId?: string }).notificationId === notificationId
      ) {
        j.processedAt = new Date();
        claimed.push(j.id);
      }
    }
    return claimed;
  }
}

export const sub = (id: string): PushSub => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: "p",
  auth: "a",
  failureCount: 0,
});

export const person = (id: string, name = id): PublicUser => ({
  id,
  name,
  username: id,
  avatarUrl: null,
  bio: null,
});
