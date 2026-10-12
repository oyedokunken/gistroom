// Creates six clearly named QA accounts for testing with real people and real devices.
//   npm run seed:qa                     dev and test schemas
//   npm run seed:qa -- --allow-prod-qa  the production schema, owner only
// The password comes from QA_PASSWORD in the environment. It is never written to a file or printed.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../packages/db/src/index";
import { seedReference } from "../packages/db/src/seed/reference";
import { hashPassword } from "../apps/web/src/server/auth/password";
import { TOPICS } from "../packages/shared/src";

const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m?.[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

const schema = process.env.DATABASE_SCHEMA ?? "public";
const safeSchema = schema === "gistroom_dev" || schema === "gistroom_test";
const allowProd = process.argv.includes("--allow-prod-qa");
if (!safeSchema && !allowProd) {
  process.stderr.write(
    `seed:qa refuses to run against the "${schema}" schema. Pass --allow-prod-qa if you really mean production.\n`,
  );
  process.exit(1);
}

const password = process.env.QA_PASSWORD ?? "";
if (password.length < 10) {
  process.stderr.write("seed:qa needs QA_PASSWORD in the environment, at least 10 characters.\n");
  process.exit(1);
}

const ACCOUNTS = [
  { key: "host", name: "QA Host", withInterests: true },
  { key: "moderator", name: "QA Moderator", withInterests: true },
  { key: "member1", name: "QA Member One", withInterests: true },
  { key: "member2", name: "QA Member Two", withInterests: true },
  { key: "outsider", name: "QA Outsider", withInterests: true },
  { key: "newuser", name: "QA New User", withInterests: false },
] as const;

const db = getDb();
await seedReference(db);
const hash = await hashPassword(password);
const now = new Date();
const ids = new Map<string, string>();

for (const a of ACCOUNTS) {
  const email = `qa.${a.key}@example.com`;
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      emailVerifiedAt: now,
      passwordHash: hash,
      name: a.name,
      username: `qa_${a.key}`,
      bio: "Internal QA account. Not a real person.",
      onboardedAt: now,
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      isInternal: true,
    },
    // Running it again resets the password and keeps the account internal.
    update: { passwordHash: hash, isInternal: true, status: "ACTIVE" },
  });
  ids.set(a.key, user.id);
  if (a.withInterests) {
    await db.userInterest.createMany({
      data: TOPICS.slice(0, 5).map((t) => ({ userId: user.id, topicSlug: t.slug })),
      skipDuplicates: true,
    });
  }
}

// The host, moderator and both members are friends with each other. The outsider and the new user know nobody.
const circle = ["host", "moderator", "member1", "member2"];
let friendships = 0;
for (const [i, a] of circle.entries()) {
  for (const b of circle.slice(i + 1)) {
    const x = ids.get(a) ?? "";
    const y = ids.get(b) ?? "";
    const [low, high] = x < y ? [x, y] : [y, x];
    await db.friendship.upsert({
      where: { userLowId_userHighId: { userLowId: low, userHighId: high } },
      create: { userLowId: low, userHighId: high },
      update: {},
    });
    const dmKey = `${low}:${high}`;
    const existing = await db.conversation.findUnique({ where: { dmKey } });
    if (!existing) {
      await db.conversation.create({
        data: { dmKey, members: { create: [{ userId: x }, { userId: y }] } },
      });
    }
    friendships += 1;
  }
}

process.stdout.write(
  `seed:qa: ${ACCOUNTS.length} internal accounts ready in schema ${schema} (${friendships} friendships).\n` +
    "seed:qa: sign in as qa.host@example.com, qa.moderator@example.com, qa.member1@example.com, qa.member2@example.com, qa.outsider@example.com and qa.newuser@example.com with QA_PASSWORD.\n",
);
await db.$disconnect();
