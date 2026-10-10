import { z } from "zod";
import { parseEnv } from "@gistroom/shared";

const bool = z.enum(["true", "false"]).default("false");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
    GOOGLE_AUTH_ENABLED: bool,
    GOOGLE_MODE: z.enum(["real", "mock"]).default("mock"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),
    MAIL_TRANSPORT: z.enum(["console", "capture", "smtp"]).default("console"),
    MAIL_ENABLE_REAL: bool,
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_MEDIA_BUCKET: z.string().default("media"),
    SUPABASE_PUBLIC_BUCKET: z.string().default("avatars"),
    LIVEKIT_URL: z.string().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.GOOGLE_MODE === "mock") {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_MODE"],
        message: "mock is refused in production",
      });
    }
  });

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/** Validated server env. Import only from server code. Fails fast with a readable list. */
export function getEnv(): ServerEnv {
  cached ??= parseEnv(schema, process.env);
  return cached;
}

/** For tests that need a fresh read after changing process.env. */
export function resetEnvCache() {
  cached = undefined;
}

/**
 * The public origin of the app, read without validating the rest of the environment. Routes that need no
 * database (cookie consent, the contact form origin check) use this so a missing secret cannot break them.
 */
export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
