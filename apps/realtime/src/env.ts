import { z } from "zod";
import { parseEnv } from "@gistroom/shared";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SCHEMA: z.enum(["gistroom_dev", "gistroom_test", "public"]),
  REALTIME_PASS_SECRET: z.string().min(32),
  INTERNAL_SERVICE_TOKEN: z.string().min(32),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:security@gistroom.ng"),
  LOG_LEVEL: z.string().default("info"),
});

export type RealtimeEnv = z.infer<typeof schema>;

/** Validated at boot. A missing secret stops the service with a readable list. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): RealtimeEnv {
  return parseEnv(schema, source);
}
