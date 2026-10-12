import { z } from "zod";
import { pushCopy } from "./content/push";
import type { NotificationType } from "./dto";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "FRIEND_REQUEST_RECEIVED",
  "FRIEND_REQUEST_ACCEPTED",
  "DM_MESSAGE",
  "CALL_MISSED",
  "ROOM_INVITE",
  "ROOM_STARTING",
  "ROOM_ROLE_CHANGED",
  "ROOM_ENDED",
  "SECURITY_NEW_DEVICE",
  "REPORT_UPDATE",
  "SYSTEM",
];

export interface ChannelSwitches {
  inApp: boolean;
  push: boolean;
  email: boolean;
}

/** Email is only on by default where a missed message really costs something (Section 10.1). */
export function defaultSwitches(type: NotificationType): ChannelSwitches {
  return {
    inApp: true,
    // A finished room is only worth a line in the list.
    push: type !== "ROOM_ENDED",
    email:
      type === "CALL_MISSED" ||
      type === "SECURITY_NEW_DEVICE" ||
      type === "ROOM_INVITE" ||
      type === "ROOM_STARTING",
  };
}

export const switchesSchema = z.object({
  inApp: z.boolean(),
  push: z.boolean(),
  email: z.boolean(),
});

const timeOfDay = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Use a time like 22:00.");

export const notificationPrefsSchema = z.object({
  switches: z.record(z.string(), switchesSchema).default({}),
  previews: z.boolean().default(true),
  quietStart: timeOfDay.nullable().default(null),
  quietEnd: timeOfDay.nullable().default(null),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const defaultPrefs: NotificationPrefs = {
  switches: {},
  previews: true,
  quietStart: null,
  quietEnd: null,
};

function minutesInZone(now: Date, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
  }
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Quiet hours in the person's own time zone. A window like 22:00 to 07:00 wraps past midnight. */
export function inQuietHours(
  now: Date,
  timeZone: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start || !end || start === end) return false;
  const cur = minutesInZone(now, timeZone);
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

/** Which channels may fire for this event right now. Quiet hours silence push and email, not the in app list. */
export function channelsFor(input: {
  type: NotificationType;
  prefs: NotificationPrefs;
  timeZone: string;
  now: Date;
}): ChannelSwitches {
  const sw = input.prefs.switches[input.type] ?? defaultSwitches(input.type);
  const quiet = inQuietHours(
    input.now,
    input.timeZone,
    input.prefs.quietStart,
    input.prefs.quietEnd,
  );
  return { inApp: sw.inApp, push: sw.push && !quiet, email: sw.email && !quiet };
}

/** Where a notification opens. Always inside the app (Section 10.6). */
export function notificationHref(type: NotificationType, payload: Record<string, unknown>): string {
  const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : null);
  switch (type) {
    case "FRIEND_REQUEST_RECEIVED":
      return "/app/friends?tab=requests";
    case "FRIEND_REQUEST_ACCEPTED":
      return str("conversationId") ? `/app/chats/${str("conversationId")}` : "/app/friends";
    case "DM_MESSAGE":
      return str("conversationId") ? `/app/chats/${str("conversationId")}` : "/app/chats";
    case "CALL_MISSED":
      return "/app/calls";
    case "ROOM_INVITE":
    case "ROOM_STARTING":
    case "ROOM_ROLE_CHANGED":
    case "ROOM_ENDED":
      return str("roomSlug") ? `/app/rooms/${str("roomSlug")}` : "/app/rooms";
    case "ACTIVITY":
      return str("href") ?? "/app/notifications";
    case "SECURITY_NEW_DEVICE":
      return "/app/settings/devices";
    case "REPORT_UPDATE":
    case "SYSTEM":
      return "/app/notifications";
  }
}

// ---------- Push policy (Section 10.2) ----------

export type PushKind =
  | "CALL_INCOMING"
  | "CALL_CANCEL"
  | "DM_MESSAGE"
  | "FRIEND_REQUEST"
  | "ROOM_INVITE"
  | "ROOM_STARTING"
  | "SECURITY_NEW_DEVICE"
  | "GENERIC";

export interface PushPolicy {
  ttlSec: number;
  urgency: "very-low" | "low" | "normal" | "high";
  requireInteraction: boolean;
}

export const PUSH_POLICY: Record<PushKind, PushPolicy> = {
  CALL_INCOMING: { ttlSec: 45, urgency: "high", requireInteraction: true },
  CALL_CANCEL: { ttlSec: 45, urgency: "high", requireInteraction: false },
  DM_MESSAGE: { ttlSec: 86_400, urgency: "normal", requireInteraction: false },
  FRIEND_REQUEST: { ttlSec: 604_800, urgency: "normal", requireInteraction: false },
  ROOM_INVITE: { ttlSec: 3_600, urgency: "normal", requireInteraction: false },
  ROOM_STARTING: { ttlSec: 900, urgency: "high", requireInteraction: false },
  SECURITY_NEW_DEVICE: { ttlSec: 86_400, urgency: "high", requireInteraction: false },
  GENERIC: { ttlSec: 86_400, urgency: "normal", requireInteraction: false },
};

export interface PushPayload {
  type: PushKind;
  title: string;
  body: string;
  url: string;
  tag: string;
  badge: number;
  data: Record<string, unknown>;
}

export const GENERIC_BODY = "New message";
export const PUSH_MAX_BYTES = 4096;

/** Collapse key. DMs collapse per conversation, calls per call. */
export function pushTag(kind: PushKind, ref: string): string {
  switch (kind) {
    case "CALL_INCOMING":
    case "CALL_CANCEL":
      return `call:${ref}`;
    case "DM_MESSAGE":
      return `dm:${ref}`;
    case "FRIEND_REQUEST":
      return `fr:${ref}`;
    case "ROOM_INVITE":
      return `room:${ref}`;
    case "ROOM_STARTING":
      return `roomstart:${ref}`;
    case "SECURITY_NEW_DEVICE":
      return `sec:${ref}`;
    case "GENERIC":
      return `n:${ref}`;
  }
}

/** Small JSON payload under 4 KB. With previews off the body is generic (Section 10.2). */
export function buildPushPayload(input: {
  type: PushKind;
  title: string;
  body: string;
  url: string;
  ref: string;
  previews: boolean;
  badge: number;
  data?: Record<string, unknown>;
}): PushPayload {
  const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);
  const body = input.previews || input.type.startsWith("CALL") ? input.body : GENERIC_BODY;
  return {
    type: input.type,
    title: trim(input.title, 80),
    body: trim(body, 160),
    url: input.url,
    tag: pushTag(input.type, input.ref),
    badge: input.badge,
    data: input.data ?? {},
  };
}

/**
 * The same push with no names and no previews, for a device whose session has ended. It still opens the right place:
 * the sign in page sends the person on to the same link afterwards (Section 10.3).
 */
export function plainPushPayload(full: PushPayload): PushPayload {
  const byKind: Record<PushKind, { title: string; body: string }> = {
    CALL_INCOMING: { title: pushCopy.plainCallTitle, body: pushCopy.plainCall },
    CALL_CANCEL: { title: pushCopy.plainTitle, body: pushCopy.plainMissedCall },
    DM_MESSAGE: { title: pushCopy.plainTitle, body: pushCopy.plainMessage },
    FRIEND_REQUEST: { title: pushCopy.plainTitle, body: pushCopy.plainFriend },
    ROOM_INVITE: { title: pushCopy.plainTitle, body: pushCopy.plainRoomInvite },
    ROOM_STARTING: { title: pushCopy.plainTitle, body: pushCopy.plainRoomStarting },
    SECURITY_NEW_DEVICE: { title: pushCopy.plainTitle, body: pushCopy.plainSecurity },
    GENERIC: { title: pushCopy.plainTitle, body: pushCopy.plainOther },
  };
  const text = byKind[full.type];
  const keep: Record<string, unknown> = {};
  for (const k of ["callId", "reason", "notificationId"]) {
    if (full.data[k] !== undefined) keep[k] = full.data[k];
  }
  return { ...full, title: text.title, body: text.body, data: keep };
}

/** Whether a device whose session ended `endedAt` still gets plain alerts. */
export function withinPushGrace(endedAt: Date, now: Date, graceDays: number): boolean {
  return now.getTime() - endedAt.getTime() <= graceDays * 86_400_000;
}

/** Decide between a socket nudge and a push. Calls always push (Section 10.1). */
export function deliveryPlan(input: { hasFocusedSocket: boolean; kind: PushKind }): {
  socket: boolean;
  push: boolean;
} {
  const isCall = input.kind === "CALL_INCOMING" || input.kind === "CALL_CANCEL";
  if (isCall) return { socket: input.hasFocusedSocket, push: true };
  return { socket: input.hasFocusedSocket, push: !input.hasFocusedSocket };
}

/** Three failures in a row and the person is told this device may not be getting alerts. */
export function isUnhealthy(failureCount: number, threshold = 3): boolean {
  return failureCount >= threshold;
}

/** Revoke a push subscription after 404 or 410, or after repeated failures. */
export function shouldRevoke(input: { statusCode: number | null; failureCount: number }): boolean {
  if (input.statusCode === 404 || input.statusCode === 410) return true;
  return input.failureCount >= 5;
}

export interface NotificationCopy {
  kind: PushKind;
  title: string;
  body: string;
  /** What the collapse tag is keyed on, for example the conversation id. */
  ref: string;
  url: string;
}

/** Title, body and push kind for a stored notification. Pure, so the web list and the push builder agree. */
export function notificationCopy(
  type: NotificationType,
  payload: Record<string, unknown>,
  id: string,
): NotificationCopy {
  const s = (k: string, fallback = ""): string =>
    typeof payload[k] === "string" ? (payload[k] as string) : fallback;
  const n = (k: string, fallback = 0): number =>
    typeof payload[k] === "number" ? (payload[k] as number) : fallback;
  const url = notificationHref(type, payload);
  switch (type) {
    case "FRIEND_REQUEST_RECEIVED":
      return {
        kind: "FRIEND_REQUEST",
        title: pushCopy.friendRequestTitle,
        body: pushCopy.friendRequestBody(s("fromName", "Someone"), s("fromUsername", "someone")),
        ref: s("requestId", id),
        url,
      };
    case "FRIEND_REQUEST_ACCEPTED":
      return {
        kind: "GENERIC",
        title: pushCopy.friendAcceptedTitle,
        body: pushCopy.friendAcceptedBody(s("name", "Your friend")),
        ref: s("requestId", id),
        url,
      };
    case "DM_MESSAGE": {
      const count = n("count", 1);
      return {
        kind: "DM_MESSAGE",
        title: pushCopy.dmTitle(s("fromName", "New message")),
        body: count > 1 ? pushCopy.dmMany(count) : s("preview", GENERIC_BODY),
        ref: s("conversationId", id),
        url,
      };
    }
    case "CALL_MISSED":
      return {
        kind: "GENERIC",
        title: pushCopy.missedCallTitle,
        body: pushCopy.missedCallBody(s("fromName", "someone")),
        ref: id,
        url,
      };
    case "ROOM_INVITE":
      return {
        kind: "ROOM_INVITE",
        title: pushCopy.roomInviteTitle,
        body: pushCopy.roomInviteBody(s("fromName", "A friend"), s("roomTitle", "a room")),
        ref: s("roomId", id),
        url,
      };
    case "ROOM_STARTING":
      return {
        kind: "ROOM_STARTING",
        title: payload["live"] === true ? pushCopy.roomLiveTitle : pushCopy.roomStartingTitle,
        body:
          payload["live"] === true
            ? pushCopy.roomLiveBody(s("roomTitle", "Your room"))
            : pushCopy.roomStartingBody(s("roomTitle", "Your room")),
        ref: s("roomId", id),
        url,
      };
    case "ROOM_ROLE_CHANGED": {
      const role = s("role", "moderator").toLowerCase();
      const room = s("roomTitle", "the room");
      const body =
        role === "removed"
          ? pushCopy.removedBody(room)
          : role === "banned"
            ? pushCopy.bannedBody(room)
            : role === "member"
              ? pushCopy.demotedBody(room)
              : pushCopy.roleChangedBody(role, room);
      return {
        kind: "GENERIC",
        title:
          role === "removed" || role === "banned"
            ? pushCopy.removedTitle
            : pushCopy.roleChangedTitle,
        body,
        ref: id,
        url,
      };
    }
    case "ROOM_ENDED":
      return {
        kind: "GENERIC",
        title: pushCopy.roomEndedTitle,
        body: pushCopy.roomEndedBody(s("roomTitle", "The room")),
        ref: s("roomId", id),
        url,
      };
    case "ACTIVITY":
      return {
        kind: "GENERIC",
        title: pushCopy.activityTitle,
        body: s("text", pushCopy.genericBody),
        ref: id,
        url,
      };
    case "SECURITY_NEW_DEVICE":
      return {
        kind: "SECURITY_NEW_DEVICE",
        title: pushCopy.securityTitle,
        body: pushCopy.securityBody(s("device", "a new device")),
        ref: s("sessionId", id),
        url,
      };
    case "REPORT_UPDATE":
      return {
        kind: "GENERIC",
        title: pushCopy.reportTitle,
        body: pushCopy.reportBody,
        ref: id,
        url,
      };
    case "SYSTEM":
      return {
        kind: "GENERIC",
        title: s("title", pushCopy.systemTitle),
        body: s("body", pushCopy.systemBody),
        ref: id,
        url,
      };
  }
}
