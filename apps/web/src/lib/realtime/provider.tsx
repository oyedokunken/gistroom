"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import type { CallDto, ConversationDto, ServerEvents } from "@gistroom/shared";
import { useCallStore } from "@/lib/calls/store";
import { useRoomStore } from "@/lib/rooms/store";
import { session as sessionCopy } from "@/content/session";
import { useLive } from "@/lib/live/live-session";
import { pushChip } from "@/lib/session/chips";
import { sounds } from "@/lib/sound/sounds";
import { apiFetch } from "@/lib/api";
import {
  advancePeerCursor,
  bumpConversation,
  findMessage,
  upsertMessage,
  type CachedMessages,
} from "@/lib/chat/cache";
import { keys } from "@/lib/chat/hooks";
import { useRealtimeStore } from "./store";

export interface RealtimeApi {
  typing: (conversationId: string, on: boolean) => void;
  ack: (conversationId: string, messageId: string, kind: "delivered" | "read") => void;
}

const Context = createContext<RealtimeApi | null>(null);

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";
/** The pass lasts 15 minutes. Reconnect with a fresh one a little before it runs out (Section 6.3). */
const PASS_REFRESH_MS = 13 * 60_000;

function isFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

/** Keeps the socket alive, mirrors server events into the query cache and resyncs after any gap. */
export function RealtimeProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const store = useRealtimeStore.getState();
    store.reset();

    const socket = io(REALTIME_URL, {
      // A function, so every reconnect attempt gets a fresh pass instead of a stale one.
      auth: (cb) => {
        apiFetch<{ token: string }>("/api/realtime/pass")
          .then((r) => {
            passFailed = false;
            cb({ token: r.token });
          })
          .catch(() => {
            // A pass that could not be fetched (offline, a cold start, a database blip) is not a sign out.
            passFailed = true;
            cb({ token: "" });
          });
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15_000,
      randomizationFactor: 0.5,
    });
    socketRef.current = socket;

    const resync = () => {
      // Postgres is the source of truth: after any gap, refetch what we may have missed (Section 6.1).
      void queryClient.invalidateQueries({ queryKey: ["unread"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      const open = useRealtimeStore.getState().openConversationId;
      if (open) void queryClient.invalidateQueries({ queryKey: keys.messages(open) });
    };

    let passFailed = false;
    // Only leave for the sign in page when the server itself says there is no session. Anything else retries.
    const confirmSignedOut = async () => {
      try {
        const r = await apiFetch<{ authed: boolean; unknown?: boolean }>("/api/auth/session");
        return !r.authed && !r.unknown;
      } catch {
        return false;
      }
    };
    const sendFocus = () => socket.connected && socket.emit("app:focus", { focused: isFocused() });
    let firstConnect = true;

    socket.on("connect", () => {
      useRealtimeStore.getState().setConnection("online");
      sendFocus();
      if (!firstConnect) resync();
      firstConnect = false;
    });
    socket.on("disconnect", () => {
      useRealtimeStore.getState().setConnection(navigator.onLine ? "reconnecting" : "offline");
    });
    socket.on("connect_error", (err: Error & { data?: { code?: string } }) => {
      const code = err.data?.code;
      if ((code === "unauthorized" || code === "session_revoked") && !passFailed) {
        void confirmSignedOut().then((out) => {
          if (out) {
            socket.disconnect();
            router.replace("/login?error=session_expired");
          }
        });
        useRealtimeStore.getState().setConnection("reconnecting");
        return;
      }
      useRealtimeStore.getState().setConnection(navigator.onLine ? "reconnecting" : "offline");
    });

    type Handler<K extends keyof ServerEvents> = (payload: ServerEvents[K]) => void;
    const on = <K extends keyof ServerEvents>(event: K, handler: Handler<K>) => {
      socket.on(event as string, handler as (...args: unknown[]) => void);
    };

    on("presence:update", (p) =>
      useRealtimeStore
        .getState()
        .setPresence(p.userId, { online: p.online, lastSeenAt: p.lastSeenAt }),
    );
    on("typing:start", (p) =>
      useRealtimeStore.getState().setTyping(p.conversationId, p.userId, true),
    );
    on("typing:stop", (p) =>
      useRealtimeStore.getState().setTyping(p.conversationId, p.userId, false),
    );

    on("message:new", ({ conversationId, message }) => {
      queryClient.setQueryData<CachedMessages>(keys.messages(conversationId), (c) =>
        upsertMessage(c, message),
      );
      const open = useRealtimeStore.getState().openConversationId === conversationId && isFocused();
      let missing = false;
      for (const archived of [false, true]) {
        queryClient.setQueryData<{ conversations: ConversationDto[]; archivedUnread: number }>(
          keys.conversations(archived),
          (data) => {
            if (!data) return data;
            const next = bumpConversation(data.conversations, message, userId, { open });
            if (!next) {
              missing = missing || !archived;
              return data;
            }
            return { ...data, conversations: next };
          },
        );
      }
      if (missing) void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (message.senderId !== userId && !open && message.type !== "SYSTEM") {
        sounds().play("message");
      }
      if (message.senderId !== userId) {
        socket.emit("message:ack", {
          conversationId,
          messageId: message.id,
          kind: open ? "read" : "delivered",
        });
      }
    });
    on("message:updated", ({ conversationId, message }) => {
      queryClient.setQueryData<CachedMessages>(keys.messages(conversationId), (c) =>
        upsertMessage(c, message),
      );
    });
    const receipt =
      (kind: "delivered" | "read"): Handler<"message:delivered" | "message:read"> =>
      ({ conversationId, messageId }) => {
        const cache = queryClient.getQueryData<CachedMessages>(keys.messages(conversationId));
        const msg = findMessage(cache, messageId);
        if (!msg) {
          void queryClient.invalidateQueries({ queryKey: keys.messages(conversationId) });
          return;
        }
        queryClient.setQueryData<CachedMessages>(keys.messages(conversationId), (c) =>
          advancePeerCursor(c, kind, msg.createdAt),
        );
      };
    on("message:delivered", receipt("delivered"));
    on("message:read", receipt("read"));

    on("friend:request", () => {
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    });
    on("friend:accepted", () => {
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
    on("notification:new", ({ notification }) => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      // Someone tried to call while I am on a call or in a room: a quiet chip, never a ring on top of the conversation.
      const busy = useLive.getState().kind !== null;
      const from = (notification.payload as { fromName?: unknown } | null)?.fromName;
      if (busy && notification.type === "CALL_MISSED" && typeof from === "string") {
        pushChip({ text: sessionCopy.call.triedChip(from), kind: "call" });
      }
    });
    on("badge:update", (counts) => {
      queryClient.setQueryData(["unread"], counts);
      // Badge API where supported (Section 11).
      const nav = navigator as Navigator & {
        setAppBadge?: (n: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      const total = counts.notifications + counts.chats;
      if (total > 0) void nav.setAppBadge?.(total).catch(() => undefined);
      else void nav.clearAppBadge?.().catch(() => undefined);
    });
    on("call:incoming", ({ call }) => {
      const calls = useCallStore.getState();
      // Already on the call screen for this one, or another ring is showing: keep what is there.
      if (calls.incoming && calls.incoming.id !== call.id) return;
      calls.setIncoming(call);
    });
    const callMoved = ({ call }: { call: CallDto }) => {
      useCallStore.getState().update(call);
      void queryClient.invalidateQueries({ queryKey: ["calls"] });
    };
    on("call:accepted", callMoved);
    on("call:cancelled", callMoved);
    on("call:ended", callMoved);
    on("room:invite", () => {
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
    on("room:started", ({ roomSlug }) => {
      void queryClient.invalidateQueries({ queryKey: ["room", roomSlug] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
    });
    on("room:ended", ({ roomSlug }) => {
      useRoomStore.getState().markEnded(roomSlug);
      void queryClient.invalidateQueries({ queryKey: ["room", roomSlug] });
      void queryClient.invalidateQueries({ queryKey: ["my-rooms"] });
      void queryClient.invalidateQueries({ queryKey: ["calls"] });
    });
    on("room:member_updated", ({ roomSlug, userId: who, state }) => {
      if (who === userId && (state === "REMOVED" || state === "BANNED")) {
        useRoomStore.getState().markKicked(roomSlug, state);
      }
      void queryClient.invalidateQueries({ queryKey: ["room", roomSlug] });
      void queryClient.invalidateQueries({ queryKey: ["room-members", roomSlug] });
    });
    on("room:chat:new", ({ roomSlug }) => {
      void queryClient.invalidateQueries({ queryKey: ["room-chat", roomSlug] });
    });
    on("room:chat:deleted", ({ roomSlug }) => {
      void queryClient.invalidateQueries({ queryKey: ["room-chat", roomSlug] });
    });
    on("room:locked", ({ roomSlug }) => {
      void queryClient.invalidateQueries({ queryKey: ["room", roomSlug] });
    });
    on("room:settings", ({ roomSlug }) => {
      void queryClient.invalidateQueries({ queryKey: ["room", roomSlug] });
      void queryClient.invalidateQueries({ queryKey: ["room-log", roomSlug] });
    });
    on("room:reaction", ({ roomSlug, userId: who, emoji }) => {
      useRoomStore.getState().addReaction(roomSlug, who, emoji);
    });
    on("room:muted", ({ roomSlug, userId: who, kind }) => {
      if (kind === "all" || who === userId) useRoomStore.getState().setNotice(roomSlug, kind);
      // Chips and a soft tone, so everyone in the room sees that a moderator acted.
      if (kind === "all" || who === userId) {
        pushChip({
          text: kind === "video" ? sessionCopy.chips.camOff : sessionCopy.chips.youMuted,
          kind: "mod",
        });
        sounds().play("muted");
      } else {
        const name = useLive
          .getState()
          .participants.find((p) => p.identity === `user_${who}`)?.name;
        if (name) pushChip({ text: sessionCopy.chips.mutedBy(name), kind: "mod" });
      }
    });
    on("session:revoked", () => {
      void confirmSignedOut().then((out) => {
        if (out) {
          socket.disconnect();
          router.replace("/login?error=session_expired");
        }
      });
    });

    const onVisibility = () => {
      sendFocus();
      if (document.visibilityState === "visible") resync();
    };
    const onOnline = () => {
      if (!socket.connected) socket.connect();
      resync();
    };
    const onOffline = () => useRealtimeStore.getState().setConnection("offline");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", sendFocus);
    window.addEventListener("blur", sendFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const refresh = window.setInterval(() => {
      if (socket.connected) {
        socket.disconnect();
        socket.connect();
      }
    }, PASS_REFRESH_MS);

    return () => {
      window.clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", sendFocus);
      window.removeEventListener("blur", sendFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient, router, userId]);

  const api = useMemo<RealtimeApi>(
    () => ({
      typing: (conversationId, on) => {
        const s = socketRef.current;
        if (s?.connected) s.emit(on ? "typing:start" : "typing:stop", { conversationId });
      },
      ack: (conversationId, messageId, kind) => {
        if (socketRef.current?.connected) {
          socketRef.current.emit("message:ack", { conversationId, messageId, kind });
          return;
        }
        // Socket down: the same cursor move over HTTP.
        void apiFetch(`/api/conversations/${conversationId}/read`, {
          body: { messageId, kind },
        }).catch(() => undefined);
      },
    }),
    [],
  );

  return <Context.Provider value={api}>{children}</Context.Provider>;
}

/** No-op realtime for the dev preview pages and tests. Never used in the signed in app. */
export function RealtimeStubProvider({ children }: { children: ReactNode }) {
  const api = useMemo<RealtimeApi>(() => ({ typing: () => undefined, ack: () => undefined }), []);
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

export function useRealtime(): RealtimeApi {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useRealtime must be used inside RealtimeProvider");
  return ctx;
}
