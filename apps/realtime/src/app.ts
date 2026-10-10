import { createServer, type Server as HttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { internalEventSchema } from "@gistroom/shared";
import { createDelivery, type Delivery } from "./delivery";
import { Hub } from "./hub";
import type { PushSender } from "./push";
import { createScheduler } from "./scheduler";
import { attachSockets, type Logger } from "./sockets";
import type { Store } from "./store";

export interface RealtimeOptions {
  store: Store;
  push: PushSender;
  log: Logger;
  passSecret: string;
  internalToken: string;
  allowedOrigins: string[];
  /** Test hooks. */
  now?: () => number;
  recheckMs?: number;
  passGraceMs?: number;
  schedulerIntervalMs?: number;
}

export interface Realtime {
  http: HttpServer;
  io: Server;
  hub: Hub;
  delivery: Delivery;
  scheduler: ReturnType<typeof createScheduler>;
  close: () => Promise<void>;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Builds the Express app, the Socket.IO server and the delivery pipeline. Used by server.ts and by the tests. */
export function createRealtime(options: RealtimeOptions): Realtime {
  const { store, push, log, allowedOrigins } = options;
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  // CORS allow list, no wildcard, no credentials: auth is by token (Section 20).
  app.use(cors({ origin: allowedOrigins, credentials: false }));

  const hub = new Hub();
  const http = createServer(app);
  const io = new Server(http, {
    cors: { origin: allowedOrigins, credentials: false },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    transports: ["websocket", "polling"],
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  const delivery = createDelivery({ io, hub, store, push, log });
  const scheduler = createScheduler({
    store,
    delivery,
    log,
    intervalMs: options.schedulerIntervalMs,
  });
  attachSockets({
    io,
    hub,
    store,
    passSecret: options.passSecret,
    log,
    now: options.now,
    recheckMs: options.recheckMs,
    passGraceMs: options.passGraceMs,
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "realtime",
      online: hub.onlineCount(),
      time: new Date().toISOString(),
    });
  });

  // Failed attempts are throttled per address. Internal endpoints are not reachable from browsers (CORS is off for them).
  const internalLimiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post("/internal/events", internalLimiter, (req, res) => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!safeEqual(token, options.internalToken)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const parsed = internalEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid event" });
      return;
    }
    // Answer first. Delivery can take a while and the web app should not wait on it.
    res.status(202).json({ ok: true });
    void delivery.safeHandle(parsed.data);
  });

  return {
    http,
    io,
    hub,
    delivery,
    scheduler,
    async close() {
      scheduler.stop();
      await new Promise<void>((resolve) => void io.close(() => resolve()));
    },
  };
}
