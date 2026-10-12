import { createHash, randomBytes } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { getDb, type User } from "@gistroom/db";
import { seedReference } from "../../packages/db/src/seed/reference";
import { hashPassword } from "../../apps/web/src/server/auth/password";

// The same token rules as apps/web/src/server/auth/tokens.ts, repeated here so the test loader needs nothing from the server.
const SESSION_COOKIE = "gr_session";
const newSessionToken = () => randomBytes(32).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const BASE = "http://localhost:3217";

/** Signed in specs run only when a test database is configured (TEST_DATABASE_URL in .env or the environment). */
export const dbAvailable =
  Boolean(process.env.TEST_DATABASE_URL) && process.env.DATABASE_SCHEMA === "gistroom_test";

export const E2E_PASSWORD = "e2e-long-passphrase-123";
const PREFIX = "e2e_";

export async function prepareDb(): Promise<void> {
  await seedReference(getDb());
  await cleanupE2e();
}

/** Removes everything the browser suites made. Only rows tied to e2e people are touched. */
export async function cleanupE2e(): Promise<void> {
  const db = getDb();
  const users = await db.user.findMany({
    where: { email: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const rooms = await db.room.findMany({ where: { hostId: { in: ids } }, select: { id: true } });
  const roomIds = rooms.map((r) => r.id);
  await db.roomMessage.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.roomModLog.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.roomInviteLink.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.roomMember.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.note.deleteMany({ where: { roomId: { in: roomIds } } });
  await db.room.deleteMany({ where: { id: { in: roomIds } } });
  await db.callLogEntry.deleteMany({ where: { userId: { in: ids } } });
  await db.call.deleteMany({
    where: { OR: [{ callerId: { in: ids } }, { calleeId: { in: ids } }] },
  });
  const convs = await db.conversationMember.findMany({
    where: { userId: { in: ids } },
    select: { conversationId: true },
  });
  const convIds = [...new Set(convs.map((c) => c.conversationId))];
  await db.message.updateMany({
    where: { conversationId: { in: convIds } },
    data: { replyToId: null },
  });
  await db.message.deleteMany({ where: { conversationId: { in: convIds } } });
  await db.conversation.deleteMany({ where: { id: { in: convIds } } });
  await db.friendship.deleteMany({
    where: { OR: [{ userLowId: { in: ids } }, { userHighId: { in: ids } }] },
  });
  await db.friendRequest.deleteMany({
    where: { OR: [{ requesterId: { in: ids } }, { addresseeId: { in: ids } }] },
  });
  await db.block.deleteMany({
    where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] },
  });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

export interface E2eUser {
  user: User;
  email: string;
  password: string;
}

let counter = 0;

/** A finished, onboarded account with a password and a handful of interests. */
export async function createUser(
  key: string,
  extra: { name?: string; interests?: string[]; username?: string } = {},
): Promise<E2eUser> {
  const db = getDb();
  const suffix = `${Date.now().toString(36)}${(counter += 1)}${randomBytes(2).toString("hex")}`;
  const email = `${PREFIX}${key}_${suffix}@example.com`;
  const user = await db.user.create({
    data: {
      email,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(E2E_PASSWORD),
      name: extra.name ?? `E2E ${key}`,
      username: (extra.username ?? `e2e_${key}_${suffix}`).slice(0, 20).toLowerCase(),
      onboardedAt: new Date(),
      ageConfirmedAt: new Date(),
      termsAcceptedAt: new Date(),
      cookieConsent: { v: 2, functional: false, analytics: false },
    },
  });
  const interests = extra.interests ?? ["football", "comedy", "gaming"];
  await db.userInterest.createMany({
    data: interests.map((topicSlug) => ({ userId: user.id, topicSlug })),
  });
  return { user, email, password: E2E_PASSWORD };
}

/** Signs a context in without the form: a real session row and its cookie. */
export async function signIn(context: BrowserContext, person: E2eUser): Promise<void> {
  const token = newSessionToken();
  const now = new Date();
  await getDb().session.create({
    data: {
      tokenHash: hashToken(token),
      userId: person.user.id,
      userAgent: "playwright",
      deviceLabel: "Playwright",
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 7 * 86_400_000),
    },
  });
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, url: BASE },
    {
      name: "gr_consent",
      value: encodeURIComponent(JSON.stringify({ v: 2, functional: false, analytics: false })),
      url: BASE,
    },
  ]);
}

/** Two people who are friends and have a chat together. Returns the conversation id. */
export async function befriend(a: E2eUser, b: E2eUser): Promise<string> {
  const db = getDb();
  const [low, high] = a.user.id < b.user.id ? [a.user.id, b.user.id] : [b.user.id, a.user.id];
  await db.friendship.create({ data: { userLowId: low, userHighId: high } });
  const conversation = await db.conversation.create({
    data: {
      dmKey: `${low}:${high}`,
      members: { create: [{ userId: a.user.id }, { userId: b.user.id }] },
    },
  });
  return conversation.id;
}
