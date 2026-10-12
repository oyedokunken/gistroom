import { apiFetch } from "./api";

export type PushSupport =
  | "unsupported"
  /** iPhone and iPad only deliver push to an installed Home Screen app (Section 10.4). */
  | "ios-needs-install"
  | "blocked"
  | "default"
  | "granted";

/** VAPID public keys are base64url. The push API wants bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function isIos(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** What the browser can do right now, in the words the UI needs. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (isIos(navigator.userAgent) && !isStandalone()) return "ios-needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" ? "granted" : "default";
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export type SubscribeResult = "ok" | "denied" | "unsupported" | "no-key" | "failed";

/**
 * Ask for permission and subscribe. Call this only after the primer modal, from a tap, never on first visit (Section 10.4).
 * One row per endpoint on the server, so subscribing twice from the same browser is safe.
 */
export async function subscribeToPush(
  vapidPublicKey: string | undefined,
): Promise<SubscribeResult> {
  if (pushSupport() === "unsupported") return "unsupported";
  if (!vapidPublicKey) return "no-key";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  try {
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    const json = sub.toJSON();
    await apiFetch("/api/push/subscribe", { body: { endpoint: json.endpoint, keys: json.keys } });
    return "ok";
  } catch {
    return "failed";
  }
}

/**
 * On every signed in load: if the browser still allows alerts, make sure this browser has a subscription and the
 * server knows about it. A missing subscription is recreated quietly (no prompt, permission is already granted), a
 * changed endpoint is sent to the server, and a browser that another person used before moves to this person.
 * Returns what it found, for the health panel and the denied notice.
 */
export async function syncPushOnLoad(
  vapidPublicKey: string | undefined,
): Promise<"synced" | "denied" | "off" | "unsupported" | "failed"> {
  const support = pushSupport();
  if (support === "unsupported" || support === "ios-needs-install") return "unsupported";
  if (support === "blocked") return "denied";
  if (support !== "granted" || !vapidPublicKey) return "off";
  try {
    const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    const json = sub.toJSON();
    await apiFetch("/api/push/subscribe", { body: { endpoint: json.endpoint, keys: json.keys } });
    return "synced";
  } catch {
    return "failed";
  }
}

/** Steps to turn alerts back on, by browser. */
export function allowAlertsSteps(userAgent: string): string[] {
  if (isIos(userAgent)) {
    return [
      "Open the Settings app on your iPhone.",
      "Scroll to Gistroom, or to Notifications and then Gistroom.",
      "Turn on Allow Notifications.",
    ];
  }
  if (/Firefox\//i.test(userAgent)) {
    return [
      "Click the lock icon in the address bar.",
      "Next to Notifications, remove the Blocked setting.",
      "Reload the page and turn alerts on again.",
    ];
  }
  if (/Edg\//i.test(userAgent)) {
    return [
      "Click the lock icon in the address bar and choose Permissions for this site.",
      "Set Notifications to Allow.",
      "Reload the page.",
    ];
  }
  if (/Android/i.test(userAgent)) {
    return [
      "Tap the lock icon next to the address, then Permissions.",
      "Set Notifications to Allow.",
      "Reload the page and turn alerts on again.",
    ];
  }
  return [
    "Click the lock icon next to the address.",
    "Open Site settings and set Notifications to Allow.",
    "Reload the page and turn alerts on again.",
  ];
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await apiFetch("/api/push/subscribe", {
    method: "DELETE",
    body: { endpoint: sub.endpoint },
  }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}
