import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { Server } from "socket.io";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "*.token", "*.email"],
});

const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
app.disable("x-powered-by");
app.use(pinoHttp({ logger }));
app.use(cors({ origin: allowedOrigins, credentials: false }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "realtime", time: new Date().toISOString() });
});

const httpServer = createServer(app);

// Socket handlers (auth pass, presence, messaging) arrive in Phase 2. Heartbeat per Section 8.
export const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: false },
  pingInterval: 20_000,
  pingTimeout: 20_000,
  transports: ["websocket", "polling"],
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
});

httpServer.listen(port, () => {
  logger.info({ port }, "realtime service listening");
});
