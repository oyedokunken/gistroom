import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { signRealtimePass } from "../../packages/shared/src/pass";
import { createRealtime, type Realtime } from "../../apps/realtime/src/app";
import type { PushSender, PushResult, PushTarget } from "../../apps/realtime/src/push";
import type { PushPayload } from "../../packages/shared/src";
import { FakeStore } from "./fake-store";

export const SECRET = "p".repeat(40);
export const INTERNAL = "i".repeat(40);

export class FakePush implements PushSender {
  sent: { target: PushTarget; payload: PushPayload }[] = [];
  result: PushResult = { ok: true, statusCode: 201 };
  async send(target: PushTarget, payload: PushPayload) {
    this.sent.push({ target, payload });
    return this.result;
  }
}

/** Every event a socket received, from the moment it was created. Lets a test see events that arrive right at connect. */
export const received = new WeakMap<Socket, { event: string; payload: unknown }[]>();

const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };

export interface Harness {
  store: FakeStore;
  push: FakePush;
  rt: Realtime;
  url: string;
  clients: Socket[];
  client: (
    userId: string,
    sessionId?: string,
    opts?: { token?: string; auth?: unknown },
  ) => Promise<Socket>;
  tryConnect: (
    token: unknown,
  ) => Promise<{ ok: true; socket: Socket } | { ok: false; code: string }>;
  postEvent: (body: unknown, token?: string) => Promise<number>;
  stop: () => Promise<void>;
}

export async function startHarness(
  extra: { store?: FakeStore; now?: () => number; passGraceMs?: number; recheckMs?: number } = {},
): Promise<Harness> {
  const store = extra.store ?? new FakeStore();
  const push = new FakePush();
  const rt = createRealtime({
    store,
    push,
    log: silent,
    passSecret: SECRET,
    internalToken: INTERNAL,
    allowedOrigins: ["http://localhost:3000"],
    now: extra.now,
    passGraceMs: extra.passGraceMs,
    recheckMs: extra.recheckMs,
  });
  await new Promise<void>((r) => rt.http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(rt.http.address() as AddressInfo).port}`;
  const clients: Socket[] = [];

  const tryConnect: Harness["tryConnect"] = (token) =>
    new Promise((resolve) => {
      const socket = connect(url, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
        forceNew: true,
      });
      clients.push(socket);
      const log: { event: string; payload: unknown }[] = [];
      received.set(socket, log);
      socket.onAny((event: string, payload: unknown) => log.push({ event, payload }));
      socket.on("connect", () => resolve({ ok: true, socket }));
      socket.on("connect_error", (err: Error & { data?: { code?: string } }) => {
        resolve({ ok: false, code: err.data?.code ?? err.message });
      });
    });

  return {
    store,
    push,
    rt,
    url,
    clients,
    tryConnect,
    async client(userId, sessionId = `s-${userId}`, opts = {}) {
      store.addSession(userId, sessionId);
      const token = opts.token ?? signRealtimePass({ userId, sessionId }, SECRET);
      const res = await tryConnect(token);
      if (!res.ok) throw new Error(`connect failed: ${res.code}`);
      return res.socket;
    },
    async postEvent(body, token = INTERNAL) {
      const res = await fetch(`${url}/internal/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return res.status;
    },
    async stop() {
      for (const c of clients) c.disconnect();
      await rt.close();
    },
  };
}

/** Resolve with the next payload for an event, or reject after a short wait. */
export function once<T = unknown>(socket: Socket, event: string, ms = 1500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolve true if the event arrives within the window, false otherwise. */
export function arrives(socket: Socket, event: string, ms = 300): Promise<boolean> {
  return once(socket, event, ms).then(
    () => true,
    () => false,
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until a socket has received an event, including ones that arrived before this call. */
export async function buffered<T = unknown>(socket: Socket, event: string, ms = 1500): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const hit = received.get(socket)?.find((e) => e.event === event);
    if (hit) return hit.payload as T;
    await sleep(10);
  }
  throw new Error(`timed out waiting for ${event}`);
}
