import { z } from "zod";
import { parseEnv } from "@gistroom/shared";

const schema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_REALTIME_URL: z.string().url().default("http://localhost:4000"),
  REALTIME_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  DATABASE_SCHEMA: z.enum(["gistroom_dev", "gistroom_test", "public"]),
  SESSION_SECRET: z.string().min(32),
  REALTIME_PASS_SECRET: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  CRON_SECRET: z.string().min(16),
});

/** Validated server env. Import only from server code. Phase 1 grows this with the other keys. */
export function getEnv() {
  return parseEnv(schema, process.env);
}
