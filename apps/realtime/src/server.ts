import pino from "pino";
import { createRealtime } from "./app";
import { loadEnv } from "./env";
import { createPrismaStore } from "./prisma-store";
import { createWebPushSender } from "./push";

const env = loadEnv();

// Tokens, cookies and emails never reach the logs (Section 20).
const logger = pino({
  level: env.LOG_LEVEL,
  redact: ["req.headers.authorization", "req.headers.cookie", "*.token", "*.email", "*.endpoint"],
});

const realtime = createRealtime({
  store: createPrismaStore(),
  push: createWebPushSender(
    {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    },
    logger,
  ),
  log: logger,
  passSecret: env.REALTIME_PASS_SECRET,
  internalToken: env.INTERNAL_SERVICE_TOKEN,
  allowedOrigins: env.ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean),
});

realtime.http.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "realtime service listening");
  // Catch up on anything that came due while the service slept or restarted, then keep polling.
  realtime.scheduler.start();
});

async function shutdown() {
  logger.info({}, "shutting down");
  await realtime.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
