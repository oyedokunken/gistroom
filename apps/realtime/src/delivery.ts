import type { Server } from "socket.io";
import {
  buildPushPayload,
  channelsFor,
  deliveryPlan,
  notificationCopy,
  pushCopy,
  shouldRevoke,
  type InternalEvent,
} from "@gistroom/shared";
import type { Hub } from "./hub";
import type { PushSender } from "./push";
import { emitTo, type Logger } from "./sockets";
import type { Store } from "./store";

export interface DeliveryDeps {
  io: Server;
  hub: Hub;
  store: Store;
  push: PushSender;
  log: Logger;
  now?: () => Date;
}

/**
 * Turns "something changed" hints from the web app into socket events and pushes (Section 10.1).
 * Postgres is the source of truth, so every handler reloads what it needs instead of trusting the hint.
 */
export function createDelivery(deps: DeliveryDeps) {
  const { io, hub, store, push, log } = deps;
  const now = deps.now ?? (() => new Date());

  async function deliverNotification(notificationId: string): Promise<void> {
    const bundle = await store.notificationBundle(notificationId);
    if (!bundle) return;
    const { notification, userId, prefs } = bundle;
    const channels = channelsFor({
      type: notification.type,
      prefs,
      timeZone: bundle.timeZone,
      now: now(),
    });
    const copy = notificationCopy(notification.type, notification.payload, notification.id);
    const plan = deliveryPlan({ hasFocusedSocket: hub.hasFocused(userId), kind: copy.kind });

    // Any live socket gets the list update. Only a focused one suppresses the system notification.
    if (hub.isOnline(userId)) {
      emitTo(io, userId, "notification:new", { notification });
      emitTo(io, userId, "badge:update", {
        notifications: bundle.unread,
        chats: bundle.chatsUnread,
      });
    }

    if (!plan.push || !channels.push || notification.payload.noPush === true) return;
    const payload = buildPushPayload({
      type: copy.kind,
      title: copy.title,
      body: copy.body,
      url: copy.url,
      ref: copy.ref,
      previews: prefs.previews,
      badge: bundle.unread,
      data: { notificationId: notification.id },
    });

    await Promise.all(
      bundle.subscriptions.map(async (sub) => {
        const result = await push.send(sub, payload);
        if (result.disabled) return;
        const failures = result.ok ? 0 : sub.failureCount + 1;
        await store.recordPushResult({
          subscriptionId: sub.id,
          ok: result.ok,
          revoke:
            !result.ok && shouldRevoke({ statusCode: result.statusCode, failureCount: failures }),
        });
      }),
    );
  }

  /** Called for an immediate hint and by the scheduler. A job is claimed once, so a delivery never repeats. */
  async function runNotify(notificationId: string): Promise<void> {
    const claimed = await store.claimJobsForNotification(notificationId);
    if (claimed.length === 0) return;
    await deliverNotification(notificationId);
  }

  async function handle(event: InternalEvent): Promise<void> {
    switch (event.type) {
      case "notify":
        return runNotify(event.notificationId);
      case "message:new":
      case "message:updated": {
        const loaded = await store.messageForDelivery(event.messageId);
        if (!loaded) return;
        for (const [userId, message] of loaded.byUser) {
          emitTo(io, userId, event.type, { conversationId: loaded.conversationId, message });
        }
        return;
      }
      case "receipt": {
        const peerId = await store.receiptTarget(event.conversationId, event.userId);
        if (!peerId) return;
        emitTo(io, peerId, event.kind === "read" ? "message:read" : "message:delivered", {
          conversationId: event.conversationId,
          userId: event.userId,
          messageId: event.messageId,
        });
        return;
      }
      case "friend:request": {
        const loaded = await store.friendRequestForDelivery(event.requestId);
        if (loaded)
          emitTo(io, loaded.addresseeId, "friend:request", { request: loaded.dtoForAddressee });
        return;
      }
      case "friend:accepted": {
        const loaded = await store.friendRequestForDelivery(event.requestId);
        if (!loaded || !loaded.conversationId) return;
        emitTo(io, loaded.requesterId, "friend:accepted", {
          friend: loaded.addressee,
          conversationId: loaded.conversationId,
        });
        emitTo(io, loaded.addresseeId, "friend:accepted", {
          friend: loaded.requester,
          conversationId: loaded.conversationId,
        });
        return;
      }
      case "session:revoked": {
        io.to(`session:${event.sessionId}`).emit("session:revoked", { sessionId: event.sessionId });
        io.in(`session:${event.sessionId}`).disconnectSockets(true);
        return;
      }
      case "call":
        return handleCall(event.callId, event.change);
      case "badge": {
        const counts = await store.counts(event.userId);
        emitTo(io, event.userId, "badge:update", counts);
        return;
      }
    }
  }

  async function pushToCallee(
    loaded: NonNullable<Awaited<ReturnType<Store["callForDelivery"]>>>,
    payload: ReturnType<typeof buildPushPayload>,
  ): Promise<void> {
    await Promise.all(
      loaded.calleePush.subscriptions.map(async (sub) => {
        const result = await push.send(sub, payload);
        if (result.disabled) return;
        const failures = result.ok ? 0 : sub.failureCount + 1;
        await store.recordPushResult({
          subscriptionId: sub.id,
          ok: result.ok,
          revoke:
            !result.ok && shouldRevoke({ statusCode: result.statusCode, failureCount: failures }),
        });
      }),
    );
  }

  /** Rings, answers and endings of a 1:1 call. Calls always push, even when a tab is open (Section 10.1). */
  async function handleCall(
    callId: string,
    change: "ringing" | "accepted" | "cancelled" | "ended",
  ): Promise<void> {
    const loaded = await store.callForDelivery(callId);
    if (!loaded) return;
    const eventFor = {
      ringing: "call:incoming",
      accepted: "call:accepted",
      cancelled: "call:cancelled",
      ended: "call:ended",
    } as const;
    const name = eventFor[change];
    for (const [userId, call] of loaded.dtoFor) {
      // Only the callee hears a ring. The caller already has the call on screen.
      if (change === "ringing" && userId !== loaded.calleeId) continue;
      emitTo(io, userId, name, { call });
    }
    const base = {
      ref: loaded.callId,
      previews: true,
      badge: loaded.calleePush.unread,
    };
    if (change === "ringing") {
      await pushToCallee(
        loaded,
        buildPushPayload({
          ...base,
          type: "CALL_INCOMING",
          title: pushCopy.callIncomingTitle(loaded.callerName),
          body: loaded.media === "VIDEO" ? pushCopy.callVideo : pushCopy.callAudio,
          url: `/app/call/${loaded.callId}?answer=1`,
          data: { callId: loaded.callId },
        }),
      );
    } else if (change === "cancelled" || change === "accepted") {
      // Not answered in time or cancelled by the caller: leave a quiet missed call.
      // Answered or declined: just remove the ring from every device.
      const missed = loaded.status === "MISSED" || loaded.status === "CANCELLED";
      await pushToCallee(
        loaded,
        buildPushPayload({
          ...base,
          type: "CALL_CANCEL",
          title: pushCopy.missedCallTitle,
          body: pushCopy.missedCallBody(loaded.callerName),
          url: "/app/calls",
          data: { callId: loaded.callId, ...(missed ? {} : { reason: "dismiss" }) },
        }),
      );
    }
  }

  async function safeHandle(event: InternalEvent): Promise<void> {
    try {
      await handle(event);
    } catch (error) {
      log.error({ err: String(error), type: event.type }, "delivery failed");
    }
  }

  return { handle, safeHandle, deliverNotification, runNotify };
}

export type Delivery = ReturnType<typeof createDelivery>;
