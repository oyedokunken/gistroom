import {
  advanceReceipt,
  callDto,
  dmKeyOf,
  getDb,
  messageDto,
  messageInclude,
  toNotificationDto,
  toPublicUser,
  unreadChatCount,
} from "@gistroom/db";
import {
  isUnhealthy,
  LIMITS,
  defaultPrefs,
  notificationPrefsSchema,
  type MessageDto,
  type RoomRole,
} from "@gistroom/shared";
import type { PushSub, Store } from "./store";

const GRACE_DAYS = LIMITS.PUSH_GRACE_DAYS;

const dmKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** The production Store. Reads and writes Postgres through Prisma, the same source of truth the web app uses. */
export function createPrismaStore(): Store {
  const db = getDb();

  async function peerOf(userId: string, conversationId: string): Promise<string | null> {
    const members = await db.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    if (!members.some((m) => m.userId === userId)) return null;
    return members.find((m) => m.userId !== userId)?.userId ?? null;
  }

  const DAY = 86_400_000;

  /**
   * Alerts follow the device, not the session. A device with a live session gets full text. After the session ends it
   * keeps getting plain text for 30 days, then it is marked as needing a new sign in and skipped (Section 10.3).
   */
  async function withMode(
    userId: string,
    rows: {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      failureCount: number;
      deviceId: string | null;
      sessionEndedAt: Date | null;
      needsReauth: boolean;
    }[],
  ): Promise<PushSub[]> {
    if (rows.length === 0) return [];
    const now = new Date();
    const live = await db.session.findMany({
      where: { userId, endedAt: null, revokedAt: null, expiresAt: { gt: now } },
      select: { deviceId: true },
    });
    const liveDevices = new Set(live.map((s) => s.deviceId));
    const anyLive = live.length > 0;
    const out: PushSub[] = [];
    for (const r of rows) {
      const isLive = r.deviceId ? liveDevices.has(r.deviceId) : anyLive;
      const base = {
        id: r.id,
        endpoint: r.endpoint,
        p256dh: r.p256dh,
        auth: r.auth,
        failureCount: r.failureCount,
      };
      if (isLive) {
        if (r.sessionEndedAt || r.needsReauth) {
          await db.pushSubscription.update({
            where: { id: r.id },
            data: { sessionEndedAt: null, needsReauth: false },
          });
        }
        out.push(base);
        continue;
      }
      let endedAt = r.sessionEndedAt;
      if (!endedAt) {
        const last = r.deviceId
          ? await db.session.findFirst({
              where: { userId, deviceId: r.deviceId },
              orderBy: { expiresAt: "desc" },
              select: { endedAt: true, expiresAt: true },
            })
          : null;
        endedAt = last ? (last.endedAt ?? last.expiresAt) : now;
        await db.pushSubscription.update({
          where: { id: r.id },
          data: { sessionEndedAt: endedAt },
        });
      }
      if (now.getTime() - endedAt.getTime() <= GRACE_DAYS * DAY) {
        out.push({ ...base, plain: true });
      } else {
        if (!r.needsReauth) {
          await db.pushSubscription.update({ where: { id: r.id }, data: { needsReauth: true } });
        }
        out.push({ ...base, skip: true });
      }
    }
    return out;
  }

  return {
    async subscriptionById(id) {
      const r = await db.pushSubscription.findUnique({ where: { id } });
      if (!r) return null;
      return {
        id: r.id,
        endpoint: r.endpoint,
        p256dh: r.p256dh,
        auth: r.auth,
        failureCount: r.failureCount,
      };
    },

    async sessionValid(userId, sessionId) {
      const s = await db.session.findFirst({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: "ACTIVE" },
        },
        select: { id: true },
      });
      return s !== null;
    },

    async interactablePeer(userId, conversationId) {
      const peerId = await peerOf(userId, conversationId);
      if (!peerId) return null;
      const [low, high] = userId < peerId ? [userId, peerId] : [peerId, userId];
      const [friend, blocked] = await Promise.all([
        db.friendship.findUnique({
          where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
          select: { id: true },
        }),
        db.block.count({
          where: {
            OR: [
              { blockerId: userId, blockedId: peerId },
              { blockerId: peerId, blockedId: userId },
            ],
          },
        }),
      ]);
      return friend && blocked === 0 ? peerId : null;
    },

    async friendIds(userId) {
      const rows = await db.friendship.findMany({
        where: { OR: [{ userLowId: userId }, { userHighId: userId }] },
        select: { userLowId: true, userHighId: true },
      });
      return rows.map((r) => (r.userLowId === userId ? r.userHighId : r.userLowId));
    },

    async presenceSettings(userIds) {
      const rows = await db.user.findMany({
        where: { id: { in: userIds }, status: "ACTIVE" },
        select: { id: true, showPresence: true },
      });
      return new Map(rows.map((r) => [r.id, r.showPresence]));
    },

    async markLastSeen(userId, at) {
      await db.user.update({ where: { id: userId }, data: { lastSeenAt: at } });
    },

    async ack({ userId, conversationId, messageId, kind }) {
      const peerId = await peerOf(userId, conversationId);
      if (!peerId) return null;
      const result = await advanceReceipt({ userId, conversationId, messageId, kind });
      if (!result) return null;
      if (kind === "read" && result.moved) {
        await db.notification.updateMany({
          where: { userId, dedupeKey: `dm:${conversationId}`, readAt: null },
          data: { readAt: new Date(), dedupeKey: null },
        });
      }
      const me = await db.user.findUnique({
        where: { id: userId },
        select: { sendReadReceipts: true },
      });
      return {
        moved: result.moved,
        messageId: result.messageId,
        peerId,
        announceRead: me?.sendReadReceipts ?? true,
      };
    },

    async messageForDelivery(messageId) {
      const base = await db.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true },
      });
      if (!base) return null;
      const members = await db.conversationMember.findMany({
        where: { conversationId: base.conversationId },
        select: { userId: true },
      });
      const byUser = new Map<string, MessageDto>();
      for (const m of members) {
        const row = await db.message.findUnique({
          where: { id: messageId },
          include: messageInclude(m.userId),
        });
        if (row) byUser.set(m.userId, messageDto(row, m.userId));
      }
      return { conversationId: base.conversationId, byUser };
    },

    async receiptTarget(conversationId, userId) {
      return peerOf(userId, conversationId);
    },

    async friendRequestForDelivery(requestId) {
      const r = await db.friendRequest.findUnique({
        where: { id: requestId },
        include: { requester: true, addressee: true },
      });
      if (!r) return null;
      const conv = await db.conversation.findUnique({
        where: { dmKey: dmKey(r.requesterId, r.addresseeId) },
        select: { id: true },
      });
      return {
        requesterId: r.requesterId,
        addresseeId: r.addresseeId,
        requester: toPublicUser(r.requester),
        addressee: toPublicUser(r.addressee),
        conversationId: conv?.id ?? null,
        dtoForAddressee: {
          id: r.id,
          direction: "INCOMING",
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          user: toPublicUser(r.requester),
        },
      };
    },

    async counts(userId) {
      const [notifications, chats] = await Promise.all([
        db.notification.count({ where: { userId, readAt: null } }),
        unreadChatCount(userId),
      ]);
      return { notifications, chats };
    },

    async roomForDelivery({ roomId, userId, messageId }) {
      const room = await db.room.findUnique({
        where: { id: roomId },
        include: { host: true, members: true },
      });
      if (!room) return null;
      const member = userId ? room.members.find((m) => m.userId === userId) : undefined;
      let chat = null;
      if (messageId) {
        const row = await db.roomMessage.findUnique({ where: { id: messageId } });
        const sender = row ? await db.user.findUnique({ where: { id: row.senderId } }) : null;
        if (row && sender) {
          chat = {
            id: row.id,
            clientId: row.clientId,
            sender: toPublicUser(sender),
            senderRole: (room.hostId === sender.id
              ? "HOST"
              : (room.members.find((m) => m.userId === sender.id)?.role ?? "MEMBER")) as RoomRole,
            body: row.body,
            createdAt: row.createdAt.toISOString(),
            reactions: [],
          };
        }
      }
      return {
        slug: room.slug,
        title: room.title,
        locked: room.locked,
        hostName: room.host.name,
        joinedIds: room.members.filter((m) => m.state === "JOINED").map((m) => m.userId),
        allIds: room.members.map((m) => m.userId),
        member: member ? { userId: member.userId, role: member.role, state: member.state } : null,
        chat,
      };
    },

    async callForDelivery(callId) {
      const call = await db.call.findUnique({
        where: { id: callId },
        include: { caller: true, callee: true },
      });
      if (!call) return null;
      const conv = await db.conversation.findUnique({
        where: { dmKey: dmKeyOf(call.callerId, call.calleeId) },
        select: { id: true },
      });
      const [prefsRow, subscriptions, unread] = await Promise.all([
        db.notificationPreference.findUnique({ where: { userId: call.calleeId } }),
        db.pushSubscription.findMany({ where: { userId: call.calleeId, revokedAt: null } }),
        db.notification.count({ where: { userId: call.calleeId, readAt: null } }),
      ]);
      return {
        callId: call.id,
        callerId: call.callerId,
        calleeId: call.calleeId,
        status: call.status,
        media: call.initialMedia,
        callerName: call.caller.name,
        dtoFor: new Map([
          [call.callerId, callDto(call, call.callerId, conv?.id ?? null)],
          [call.calleeId, callDto(call, call.calleeId, conv?.id ?? null)],
        ]),
        calleePush: {
          subscriptions: await withMode(call.calleeId, subscriptions),
          previews: prefsRow?.previews ?? true,
          unread,
        },
      };
    },

    async notificationBundle(notificationId) {
      const n = await db.notification.findUnique({
        where: { id: notificationId },
        include: { user: { select: { timezone: true, status: true } } },
      });
      if (!n || n.user.status !== "ACTIVE") return null;
      const [prefsRow, subscriptions, unread, chats] = await Promise.all([
        db.notificationPreference.findUnique({ where: { userId: n.userId } }),
        db.pushSubscription.findMany({ where: { userId: n.userId, revokedAt: null } }),
        db.notification.count({ where: { userId: n.userId, readAt: null } }),
        unreadChatCount(n.userId),
      ]);
      const parsed = prefsRow
        ? notificationPrefsSchema.safeParse({
            switches: prefsRow.switches,
            previews: prefsRow.previews,
            quietStart: prefsRow.quietStart,
            quietEnd: prefsRow.quietEnd,
          })
        : null;
      return {
        notification: toNotificationDto(n),
        userId: n.userId,
        timeZone: n.user.timezone,
        prefs: parsed?.success ? parsed.data : defaultPrefs,
        unread,
        chatsUnread: chats,
        subscriptions: await withMode(n.userId, subscriptions),
      };
    },

    async recordPushResult({ subscriptionId, ok, revoke }) {
      await db.pushSubscription.update({
        where: { id: subscriptionId },
        data: ok
          ? { lastSuccessAt: new Date(), failureCount: 0, unhealthyAt: null, unhealthySeenAt: null }
          : { failureCount: { increment: 1 }, ...(revoke ? { revokedAt: new Date() } : {}) },
      });
      if (!ok) {
        // Three failures in a row: remember it, so the person is told the next time they open the app.
        const row = await db.pushSubscription.findUnique({
          where: { id: subscriptionId },
          select: { failureCount: true, unhealthyAt: true },
        });
        if (row && row.unhealthyAt === null && isUnhealthy(row.failureCount)) {
          await db.pushSubscription.update({
            where: { id: subscriptionId },
            data: { unhealthyAt: new Date(), unhealthySeenAt: null },
          });
        }
      }
    },

    async dueJobs(now, limit) {
      const rows = await db.scheduledJob.findMany({
        where: { processedAt: null, dueAt: { lte: now } },
        orderBy: { dueAt: "asc" },
        take: limit,
      });
      return rows.map((r) => ({ id: r.id, kind: r.kind, payload: r.payload }));
    },

    async claimJob(id) {
      const r = await db.scheduledJob.updateMany({
        where: { id, processedAt: null },
        data: { processedAt: new Date() },
      });
      return r.count === 1;
    },

    async claimJobsForNotification(notificationId) {
      const jobs = await db.scheduledJob.findMany({
        where: {
          kind: "notify",
          processedAt: null,
          payload: { path: ["notificationId"], equals: notificationId },
        },
        select: { id: true },
      });
      const claimed: string[] = [];
      for (const j of jobs) {
        const r = await db.scheduledJob.updateMany({
          where: { id: j.id, processedAt: null },
          data: { processedAt: new Date() },
        });
        if (r.count === 1) claimed.push(j.id);
      }
      return claimed;
    },
  };
}
