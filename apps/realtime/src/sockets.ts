import type { Server, Socket } from "socket.io";
import type { ZodTypeAny, z } from "zod";
import {
  ackEventSchema,
  clientEvents,
  focusEventSchema,
  typingEventSchema,
  type ServerEvents,
} from "@gistroom/shared";
import { verifyRealtimePass } from "@gistroom/shared/pass";
import { SOCKET_LIMITS, StrikeCounter, TokenBucket } from "./buckets";
import { Hub, sessionRoom, userRoom } from "./hub";
import type { Store } from "./store";

export interface Logger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

export interface SocketDeps {
  io: Server;
  hub: Hub;
  store: Store;
  passSecret: string;
  log: Logger;
  now?: () => number;
  /** Test hooks: shorter timers. */
  recheckMs?: number;
  passGraceMs?: number;
}

interface SocketData {
  userId: string;
  sessionId: string;
  passExp: number;
}

const authError = (code: string) => Object.assign(new Error(code), { data: { code } });

/** Emit a typed server event to one person's sockets. */
export function emitTo<K extends keyof ServerEvents>(
  io: Server,
  userId: string,
  event: K,
  payload: ServerEvents[K],
): void {
  io.to(userRoom(userId)).emit(event, payload);
}

/** Tell friends who may see it that this person went online or offline (Section 9.3b). */
export async function announcePresence(
  deps: SocketDeps,
  userId: string,
  online: boolean,
  lastSeenAt: Date | null,
) {
  const { io, store } = deps;
  const friends = await store.friendIds(userId);
  if (friends.length === 0) return;
  const settings = await store.presenceSettings([userId, ...friends]);
  if (!settings.get(userId)) return;
  for (const friendId of friends) {
    if (!settings.get(friendId)) continue;
    emitTo(io, friendId, "presence:update", {
      userId,
      online,
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
    });
  }
}

/** On connect, show the person which of their friends are online right now. */
async function sendSnapshot(deps: SocketDeps, userId: string, socket: Socket) {
  const { hub, store } = deps;
  const friends = await store.friendIds(userId);
  const settings = await store.presenceSettings([userId, ...friends]);
  if (!settings.get(userId)) return;
  for (const friendId of friends) {
    if (settings.get(friendId) && hub.isOnline(friendId)) {
      socket.emit("presence:update", { userId: friendId, online: true, lastSeenAt: null });
    }
  }
}

export function attachSockets(deps: SocketDeps): void {
  const { io, hub, store, log } = deps;
  const now = deps.now ?? Date.now;
  const lastSeenWritten = new Map<string, number>();

  // Connection level auth. Cookies are never used across the two domains (Section 6.3).
  io.use(async (socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof token !== "string") return next(authError("unauthorized"));
    const result = verifyRealtimePass(token, deps.passSecret, new Date(now()));
    if (!result.ok)
      return next(authError(result.reason === "EXPIRED" ? "auth_expired" : "unauthorized"));
    try {
      if (!(await store.sessionValid(result.pass.userId, result.pass.sessionId))) {
        return next(authError("session_revoked"));
      }
    } catch (error) {
      log.error({ err: String(error) }, "session check failed");
      return next(authError("unavailable"));
    }
    const exp = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { exp: number };
    const data: SocketData = {
      userId: result.pass.userId,
      sessionId: result.pass.sessionId,
      passExp: exp.exp * 1000,
    };
    Object.assign(socket.data, data);
    next();
  });

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;
    const { userId, sessionId } = data;
    void socket.join([userRoom(userId), sessionRoom(sessionId)]);

    const burst = new TokenBucket(
      SOCKET_LIMITS.burst.capacity,
      SOCKET_LIMITS.burst.refillPerSec,
      now,
    );
    const typing = new TokenBucket(
      SOCKET_LIMITS.typing.capacity,
      SOCKET_LIMITS.typing.refillPerSec,
      now,
    );
    const strikes = new StrikeCounter(
      SOCKET_LIMITS.strikes.limit,
      SOCKET_LIMITS.strikes.windowMs,
      now,
    );
    let sessionCheckedAt = now();
    const peerCache = new Map<string, { peerId: string; at: number }>();

    const first = hub.add(socket.id, { userId, sessionId, focused: false });
    if (first)
      void announcePresence(deps, userId, true, null).catch((e) =>
        log.warn({ err: String(e) }, "presence"),
      );
    void sendSnapshot(deps, userId, socket).catch((e) => log.warn({ err: String(e) }, "snapshot"));

    // The session is re-checked every 5 minutes and before sensitive events (Section 6.3).
    const recheck = setInterval(
      async () => {
        try {
          if (!(await store.sessionValid(userId, sessionId))) {
            socket.emit("session:revoked", { sessionId });
            socket.disconnect(true);
          }
          sessionCheckedAt = now();
        } catch (error) {
          log.warn({ err: String(error) }, "recheck failed");
        }
      },
      deps.recheckMs ?? 5 * 60_000,
    );

    // A pass is only good for 15 minutes. The client reconnects with a fresh one before then.
    const untilExpiry = Math.max(0, data.passExp + (deps.passGraceMs ?? 60_000) - now());
    const expiry = setTimeout(() => {
      socket.emit("auth:expired", {});
      socket.disconnect(true);
    }, untilExpiry);

    function drop(reason: string) {
      log.warn({ userId, reason }, "dropped socket event");
      if (strikes.strike()) socket.disconnect(true);
    }

    /** Every event handler: rate limit, validate, then authorize on its own (R16). */
    function guard<S extends ZodTypeAny>(
      event: string,
      schema: S,
      options: { bucket?: TokenBucket; sensitive?: boolean },
      handler: (payload: z.infer<S>) => Promise<void>,
    ) {
      socket.on(event, async (raw: unknown) => {
        if (!burst.take() || (options.bucket && !options.bucket.take())) return drop("rate");
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return drop("invalid");
        try {
          if (options.sensitive && now() - sessionCheckedAt > 60_000) {
            if (!(await store.sessionValid(userId, sessionId))) {
              socket.emit("session:revoked", { sessionId });
              socket.disconnect(true);
              return;
            }
            sessionCheckedAt = now();
          }
          await handler(parsed.data);
        } catch (error) {
          log.error({ err: String(error), event }, "handler failed");
        }
      });
    }

    async function peerFor(conversationId: string): Promise<string | null> {
      const hit = peerCache.get(conversationId);
      if (hit && now() - hit.at < 60_000) return hit.peerId;
      const peerId = await store.interactablePeer(userId, conversationId);
      if (peerId) peerCache.set(conversationId, { peerId, at: now() });
      return peerId;
    }

    guard(
      clientEvents.typingStart,
      typingEventSchema,
      { bucket: typing },
      async ({ conversationId }) => {
        const peerId = await peerFor(conversationId);
        if (!peerId) return drop("not a member");
        emitTo(io, peerId, "typing:start", { conversationId, userId });
      },
    );
    guard(
      clientEvents.typingStop,
      typingEventSchema,
      { bucket: typing },
      async ({ conversationId }) => {
        const peerId = await peerFor(conversationId);
        if (!peerId) return drop("not a member");
        emitTo(io, peerId, "typing:stop", { conversationId, userId });
      },
    );
    guard(clientEvents.appFocus, focusEventSchema, {}, async ({ focused }) => {
      hub.setFocused(socket.id, focused);
    });
    guard(clientEvents.messageAck, ackEventSchema, { sensitive: true }, async (ack) => {
      const result = await store.ack({ userId, ...ack });
      if (!result) return drop("ack not allowed");
      if (!result.moved) return;
      if (ack.kind === "delivered") {
        emitTo(io, result.peerId, "message:delivered", {
          conversationId: ack.conversationId,
          userId,
          messageId: result.messageId,
        });
      } else if (result.announceRead) {
        emitTo(io, result.peerId, "message:read", {
          conversationId: ack.conversationId,
          userId,
          messageId: result.messageId,
        });
      }
      // Other devices of mine clear their unread badge too.
      const counts = await store.counts(userId);
      emitTo(io, userId, "badge:update", counts);
    });

    // Anything we did not register is abuse, not a feature.
    socket.onAny((event: string) => {
      const known = new Set<string>(Object.values(clientEvents));
      if (!known.has(event)) drop("unknown event");
    });

    socket.on("disconnect", () => {
      clearInterval(recheck);
      clearTimeout(expiry);
      const gone = hub.remove(socket.id);
      if (!gone?.last) return;
      const at = new Date(now());
      void announcePresence(deps, gone.userId, false, at).catch((e) =>
        log.warn({ err: String(e) }, "presence"),
      );
      // lastSeenAt is written at most once a minute (Section 8).
      const prev = lastSeenWritten.get(gone.userId) ?? 0;
      if (now() - prev > 60_000) {
        lastSeenWritten.set(gone.userId, now());
        void store
          .markLastSeen(gone.userId, at)
          .catch((e) => log.warn({ err: String(e) }, "lastSeen"));
      }
    });
  });
}
