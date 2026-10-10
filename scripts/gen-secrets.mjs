import { randomBytes } from "node:crypto";

for (const key of [
  "SESSION_SECRET",
  "REALTIME_PASS_SECRET",
  "INTERNAL_SERVICE_TOKEN",
  "CRON_SECRET",
]) {
  console.log(`${key}=${randomBytes(48).toString("base64url")}`);
}
