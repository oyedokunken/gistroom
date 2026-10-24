// A targeted test world around real accounts: thirty Nigerian people, their chats, calls and rooms.
//   npm run seed:friends                      dry run, shows what would be added and changes nothing
//   npm run seed:friends -- --apply           writes it
//   npm run seed:friends -- --remove          removes every seeded person and everything about them
// Options: --email felixdrann@gmail.com  --second themastermindcreativity@gmail.com
// On the production schema it also needs --allow-prod. Seeded people are marked isSeed, never log in and are never emailed.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../packages/db/src/index";
import { PEOPLE, removeFriendsWorld, seedFriendsWorld } from "../packages/db/src/seed/friends";

const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m?.[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? (args[i + 1] as string) : fallback;
};

const schema = process.env.DATABASE_SCHEMA ?? "public";
const safe = schema === "gistroom_dev" || schema === "gistroom_test";
if (!safe && !flag("allow-prod")) {
  process.stderr.write(
    `seed:friends refuses to run on the "${schema}" schema. Add --allow-prod if you mean production.\n`,
  );
  process.exit(1);
}

const primary = value("email", "felixdrann@gmail.com");
const second = value("second", "themastermindcreativity@gmail.com");
const db = getDb();

if (flag("remove")) {
  const out = await removeFriendsWorld(db);
  process.stdout.write(
    `seed:friends: removed ${out.people} seeded people and everything about them.\n`,
  );
  await db.$disconnect();
  process.exit(0);
}

const found = {
  primary: await db.user.findUnique({ where: { email: primary }, select: { username: true } }),
  second: await db.user.findUnique({ where: { email: second }, select: { username: true } }),
};
const already = await db.user.count({ where: { isSeed: true } });
process.stdout.write(
  [
    `seed:friends on schema ${schema}`,
    `  prime user ${primary}: ${found.primary ? `found (@${found.primary.username})` : "NOT FOUND"}`,
    `  second user ${second}: ${found.second ? `found (@${found.second.username})` : "not found, their friends are skipped"}`,
    `  seeded people already there: ${already}`,
    `  would add up to ${PEOPLE.length} people (gmail.com and yahoo.com), friendships, requests, chats with real gist,`,
    `  five call records, sixteen scheduled public rooms, one private room and up to six hosted future rooms.`,
    "",
  ].join("\n"),
);
if (!found.primary) {
  process.stderr.write("Sign up the prime user first, then run this again.\n");
  process.exit(1);
}
if (!flag("apply")) {
  process.stdout.write("Dry run. Nothing was written. Add --apply to write it.\n");
  await db.$disconnect();
  process.exit(0);
}
const summary = await seedFriendsWorld(db, {
  primaryEmail: primary,
  secondEmail: found.second ? second : undefined,
});
process.stdout.write(`seed:friends: done ${JSON.stringify(summary)}\n`);
await db.$disconnect();
