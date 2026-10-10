// Event names and payloads shared by web and realtime (Section 8). Zod only, safe for the browser.
import { z } from "zod";
import type { CallDto } from "./calls";
import type { RoomChatDto, RoomRole, RoomMemberState } from "./rooms";
import type { FriendRequestDto, MessageDto, NotificationDto } from "./dto";
import type { PublicUser } from "./profile";

// ---------- Client to server ----------

export const typingEventSchema = z.object({ conversationId: z.string().min(1).max(64) });
export type TypingEvent = z.infer<typeof typingEventSchema>;

export const ackEventSchema = z.object({
  conversationId: z.string().min(1).max(64),
  messageId: z.string().min(1).max(64),
  kind: z.enum(["delivered", "read"]),
});
export type AckEvent = z.infer<typeof ackEventSchema>;

/** Names of events the client may send. Everything else is dropped and counted as abuse. */
export const clientEvents = {
  typingStart: "typing:start",
  typingStop: "typing:stop",
  messageAck: "message:ack",
  appFocus: "app:focus",
} as const;

// ---------- Server to client ----------

export interface ServerEvents {
  "presence:update": { userId: string; online: boolean; lastSeenAt: string | null };
  "typing:start": { conversationId: string; userId: string };
  "typing:stop": { conversationId: string; userId: string };
  "message:new": { conversationId: string; message: MessageDto };
  "message:updated": { conversationId: string; message: MessageDto };
  "message:delivered": { conversationId: string; userId: string; messageId: string };
  "message:read": { conversationId: string; userId: string; messageId: string };
  "friend:request": { request: FriendRequestDto };
  "friend:accepted": { friend: PublicUser; conversationId: string };
  "notification:new": { notification: NotificationDto };
  "badge:update": { notifications: number; chats: number };
  /** Someone is calling you. Sent to every open tab, and a push goes out as well. */
  "call:incoming": { call: CallDto };
  /** The callee answered. The caller is already connected and moves from ringing to talking. */
  "call:accepted": { call: CallDto };
  /** Declined, cancelled or not answered in time. Stops the ring on every device. */
  "call:cancelled": { call: CallDto };
  "call:ended": { call: CallDto };
  "room:invite": { roomSlug: string; title: string; fromName: string };
  "room:started": { roomSlug: string; title: string };
  "room:ended": { roomSlug: string };
  "room:member_updated": {
    roomSlug: string;
    userId: string;
    role: RoomRole;
    state: RoomMemberState;
  };
  "room:chat:new": { roomSlug: string; message: RoomChatDto };
  "room:chat:deleted": { roomSlug: string; messageId: string };
  "room:locked": { roomSlug: string; locked: boolean };
  "session:revoked": { sessionId: string };
  "auth:expired": Record<string, never>;
}

export type ServerEventName = keyof ServerEvents;

// ---------- Web to realtime (POST /internal/events) ----------

const id = z.string().min(1).max(64);

export const internalEventSchema = z.discriminatedUnion("type", [
  /** A Notification row exists and a ScheduledJob is waiting. Deliver now (socket or push). */
  z.object({ type: z.literal("notify"), notificationId: id }),
  z.object({ type: z.literal("message:new"), messageId: id }),
  z.object({ type: z.literal("message:updated"), messageId: id }),
  z.object({
    type: z.literal("receipt"),
    conversationId: id,
    userId: id,
    messageId: id,
    kind: z.enum(["delivered", "read"]),
  }),
  z.object({ type: z.literal("friend:request"), requestId: id }),
  z.object({ type: z.literal("friend:accepted"), requestId: id }),
  z.object({ type: z.literal("session:revoked"), userId: id, sessionId: id }),
  z.object({ type: z.literal("badge"), userId: id }),
  z.object({
    type: z.literal("room"),
    roomId: id,
    change: z.enum(["started", "ended", "member", "chat", "chat-deleted", "locked", "invite"]),
    userId: id.optional(),
    messageId: id.optional(),
  }),
  z.object({
    type: z.literal("call"),
    callId: id,
    change: z.enum(["ringing", "accepted", "cancelled", "ended"]),
  }),
]);
export type InternalEvent = z.infer<typeof internalEventSchema>;

/** Realtime asks web to send email (Section 5.1). Render free blocks SMTP. */
export const internalEmailSchema = z.object({
  template: z.enum(["missed-call"]),
  to: z.string().email(),
  props: z.record(z.string(), z.unknown()),
});
export type InternalEmail = z.infer<typeof internalEmailSchema>;

export const INTERNAL_AUTH_HEADER = "authorization";

/** The tab tells the server whether it is visible and focused, so push is skipped only when someone is looking. */
export const focusEventSchema = z.object({ focused: z.boolean() });
export type FocusEvent = z.infer<typeof focusEventSchema>;
