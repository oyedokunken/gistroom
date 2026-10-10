/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  RangeRequestsPlugin,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
} from "serwist";
import { decidePush, parsePush, planClick, sameOriginPath } from "./logic";

declare const self: ServiceWorkerGlobalScope & {
  /** Filled in by scripts/build-sw.mjs at build time. */
  __SW_MANIFEST: PrecacheEntry[];
};

const HOUR = 60 * 60;

const runtimeCaching: RuntimeCaching[] = [
  // Hashed build output never changes, so serve it from cache first.
  {
    matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "static-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 24 * HOUR })],
    }),
  },
  {
    matcher: ({ url }) => /^\/(fonts|images|brand)\//.test(url.pathname),
    handler: new StaleWhileRevalidate({
      cacheName: "public-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 14 * 24 * HOUR })],
    }),
  },
  // Reads of the signed in person's own data. A short stale window only: never keep these long (Section 11).
  {
    matcher: ({ url, request }) =>
      request.method === "GET" &&
      /^\/api\/(conversations|friends|notifications|unread|starred|users|sessions)/.test(
        url.pathname,
      ),
    handler: new NetworkFirst({
      cacheName: "api-reads",
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 10 * 60 })],
    }),
  },
  // Pages: the app shell opens offline from the last visit.
  {
    matcher: ({ request, url }) => request.mode === "navigate" && url.pathname.startsWith("/app"),
    handler: new NetworkFirst({
      cacheName: "app-pages",
      networkTimeoutSeconds: 4,
      plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 24 * HOUR })],
    }),
  },
  // Video and audio need range requests. Signed media URLs and /api/media are never cached.
  {
    matcher: ({ request }) => request.destination === "video" || request.destination === "audio",
    handler: new CacheFirst({ cacheName: "never-used", plugins: [new RangeRequestsPlugin()] }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});
serwist.addEventListeners();

// The page asks for the new version when the person taps Refresh (Section 11).
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "SKIP_WAITING") void self.skipWaiting();
});

async function windowClients() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true });
}

self.addEventListener("push", (event) => {
  const push = parsePush(event.data ? event.data.text() : null);
  event.waitUntil(
    (async () => {
      const clients = await windowClients();
      const plan = decidePush(
        push,
        clients.map((c) => ({ visible: c.visibilityState === "visible", focused: c.focused })),
      );

      // Keep the app icon badge right even when no notification is shown.
      const nav = self.navigator as WorkerNavigator & {
        setAppBadge?: (n: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (push.badge > 0) await nav.setAppBadge?.(push.badge).catch(() => undefined);
      else await nav.clearAppBadge?.().catch(() => undefined);

      for (const c of clients) c.postMessage({ type: "PUSH", push });

      if (plan.kind === "SKIP") return;
      if (plan.kind === "CANCEL_CALL") {
        for (const n of await self.registration.getNotifications({ tag: plan.tag })) n.close();
        if (plan.missed) {
          await self.registration.showNotification(plan.missed.title, plan.missed.options);
        }
        return;
      }
      await self.registration.showNotification(plan.title, plan.options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = (event.notification.data ?? {}) as { url?: string; callId?: string };
  event.notification.close();
  const plan = planClick(event.action, data);

  event.waitUntil(
    (async () => {
      if (plan.decline) {
        await fetch(`/api/calls/${plan.decline.callId}/decline`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Origin: self.location.origin },
          body: "{}",
        }).catch(() => undefined);
        return;
      }
      const target = sameOriginPath(plan.url, self.location.origin) ?? "/app/chats";
      const clients = await windowClients();
      const existing = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Browsers rotate push subscriptions. Resubscribe quietly and tell the server (Section 10.3).
self.addEventListener("pushsubscriptionchange", (event) => {
  const e = event as ExtendableEvent & { oldSubscription?: PushSubscription };
  e.waitUntil(
    (async () => {
      const key = e.oldSubscription?.options.applicationServerKey;
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Origin: self.location.origin },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      }).catch(() => undefined);
    })(),
  );
});
