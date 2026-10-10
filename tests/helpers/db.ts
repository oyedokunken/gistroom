import { getDb } from "@gistroom/db";

/**
 * Integration tests need a real Postgres. They run only when TEST_DATABASE_URL is set and
 * DATABASE_SCHEMA is gistroom_test, and they skip themselves otherwise (Section 5.3).
 */
export const testDbEnabled =
  Boolean(process.env.TEST_DATABASE_URL) && process.env.DATABASE_SCHEMA === "gistroom_test";

export function prepareTestEnv(): void {
  if (!testDbEnabled) return;
  const url = process.env.TEST_DATABASE_URL as string;
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  const defaults: Record<string, string> = {
    NODE_ENV: "test",
    APP_URL: "http://localhost:3000",
    SESSION_SECRET: "t".repeat(40),
    REALTIME_PASS_SECRET: "r".repeat(40),
    INTERNAL_SERVICE_TOKEN: "i".repeat(40),
    CRON_SECRET: "c".repeat(20),
    GOOGLE_MODE: "mock",
    MAIL_TRANSPORT: "capture",
    MAIL_ALLOWED_DOMAINS: "example.com",
  };
  for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
}

/** Deletes everything in the test schema. Refuses to run anywhere else. */
export async function resetTestDb(): Promise<void> {
  if (process.env.DATABASE_SCHEMA !== "gistroom_test") {
    throw new Error("resetTestDb only runs against gistroom_test");
  }
  const db = getDb();
  // Prisma deletes in dependency order (R7: no raw SQL outside migrations).
  await db.roomMessage.deleteMany();
  await db.roomModLog.deleteMany();
  await db.roomInviteLink.deleteMany();
  await db.roomMember.deleteMany();
  await db.room.deleteMany();
  await db.topic.deleteMany();
  await db.callLogEntry.deleteMany();
  await db.call.deleteMany();
  await db.messageHidden.deleteMany();
  await db.messageReaction.deleteMany();
  await db.messageStar.deleteMany();
  await db.messageAttachment.deleteMany();
  await db.message.updateMany({ data: { replyToId: null } });
  await db.message.deleteMany();
  await db.conversationMember.deleteMany();
  await db.conversation.deleteMany();
  await db.fileAsset.deleteMany();
  await db.notification.deleteMany();
  await db.notificationPreference.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.scheduledJob.deleteMany();
  await db.report.deleteMany();
  await db.auditLog.deleteMany();
  await db.rateLimit.deleteMany();
  await db.emailOutbox.deleteMany();
  await db.block.deleteMany();
  await db.friendship.deleteMany();
  await db.friendRequest.deleteMany();
  await db.otpChallenge.deleteMany();
  await db.session.deleteMany();
  await db.authAccount.deleteMany();
  await db.user.deleteMany();
}

export function testEmail(name: string): string {
  return `test_${name}@example.com`;
}
