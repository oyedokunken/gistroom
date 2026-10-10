// Pure decisions for the service worker. No DOM or worker types, so unit tests can import this file.

export type PushKind =
  | "CALL_INCOMING"
  | "CALL_CANCEL"
  | "DM_MESSAGE"
  | "FRIEND_REQUEST"
  | "ROOM_INVITE"
  | "ROOM_STARTING"
  | "SECURITY_NEW_DEVICE"
  | "GENERIC";

export interface PushData {
  type: PushKind;
  title: string;
  body: string;
  url: string;
  tag: string;
  badge: number;
  data: Record<string, unknown>;
}

export interface ClientInfo {
  visible: boolean;
  focused: boolean;
}

export type PushAction =
  /** Do nothing visible: a window is focused and this is not a call. The page already shows it. */
  | { kind: "SKIP" }
  | { kind: "SHOW"; title: string; options: NotificationShape }
  /** A call was cancelled: close its ring, then show a quiet missed call line with the same tag. */
  | {
      kind: "CANCEL_CALL";
      tag: string;
      missed: { title: string; options: NotificationShape } | null;
    };

export interface NotificationShape {
  body: string;
  tag: string;
  icon: string;
  badge: string;
  requireInteraction: boolean;
  renotify: boolean;
  silent: boolean;
  vibrate?: number[];
  actions?: { action: string; title: string }[];
  data: { url: string } & Record<string, unknown>;
}

const ICON = "/brand/icon-192.png";
const BADGE = "/brand/badge-96.png";
export const CALL_VIBRATION = [300, 150, 300, 150, 300];

/** Parse the payload defensively. A bad payload still produces a visible notification (Chrome requires one). */
export function parsePush(raw: string | null): PushData {
  const fallback: PushData = {
    type: "GENERIC",
    title: "Gistroom",
    body: "You have a new notification.",
    url: "/app/notifications",
    tag: "n:fallback",
    badge: 0,
    data: {},
  };
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw) as Partial<PushData>;
    return {
      type: p.type ?? fallback.type,
      title: typeof p.title === "string" && p.title ? p.title : fallback.title,
      body: typeof p.body === "string" ? p.body : fallback.body,
      url:
        typeof p.url === "string" && p.url.startsWith("/") && !p.url.startsWith("//")
          ? p.url
          : fallback.url,
      tag: typeof p.tag === "string" && p.tag ? p.tag : fallback.tag,
      badge: typeof p.badge === "number" ? p.badge : 0,
      data: p.data && typeof p.data === "object" ? p.data : {},
    };
  } catch {
    return fallback;
  }
}

export function decidePush(push: PushData, clients: readonly ClientInfo[]): PushAction {
  const isCall = push.type === "CALL_INCOMING" || push.type === "CALL_CANCEL";
  const someoneIsLooking = clients.some((c) => c.visible && c.focused);

  if (push.type === "CALL_CANCEL") {
    // When the call was answered or declined on another device, only the ring is removed.
    if (push.data.reason === "dismiss") return { kind: "CANCEL_CALL", tag: push.tag, missed: null };
    return {
      kind: "CANCEL_CALL",
      tag: push.tag,
      missed: {
        title: push.title,
        options: {
          body: push.body,
          tag: push.tag,
          icon: ICON,
          badge: BADGE,
          requireInteraction: false,
          renotify: false,
          silent: true,
          data: { url: "/app/calls", ...push.data },
        },
      },
    };
  }
  if (!isCall && someoneIsLooking) return { kind: "SKIP" };

  if (push.type === "CALL_INCOMING") {
    return {
      kind: "SHOW",
      title: push.title,
      options: {
        body: push.body,
        tag: push.tag,
        icon: ICON,
        badge: BADGE,
        requireInteraction: true,
        renotify: true,
        silent: false,
        vibrate: CALL_VIBRATION,
        actions: [
          { action: "answer", title: "Answer" },
          { action: "decline", title: "Decline" },
        ],
        data: { url: push.url, ...push.data },
      },
    };
  }
  return {
    kind: "SHOW",
    title: push.title,
    options: {
      body: push.body,
      tag: push.tag,
      icon: ICON,
      badge: BADGE,
      requireInteraction: false,
      // Messages collapse by tag but still alert each time.
      renotify: push.type === "DM_MESSAGE",
      silent: false,
      data: { url: push.url, ...push.data },
    },
  };
}

export interface ClickPlan {
  /** Path to open or focus. */
  url: string;
  /** Decline posts to the server and does not open a window. */
  decline: { callId: string } | null;
}

/** What a tap on a notification or one of its buttons does (Section 10.3). */
export function planClick(action: string, data: { url?: unknown; callId?: unknown }): ClickPlan {
  const callId = typeof data.callId === "string" ? data.callId : null;
  const base =
    typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//")
      ? data.url
      : "/app/chats";
  if (action === "decline" && callId) return { url: base, decline: { callId } };
  if (action === "answer" && callId) return { url: `/app/call/${callId}?answer=1`, decline: null };
  if (callId && !action) return { url: `/app/call/${callId}?answer=1`, decline: null };
  return { url: base, decline: null };
}

/** True when this app URL should be handled by an existing window. */
export function sameOriginPath(url: string, origin: string): string | null {
  try {
    const u = new URL(url, origin);
    return u.origin === origin ? `${u.pathname}${u.search}` : null;
  } catch {
    return null;
  }
}
