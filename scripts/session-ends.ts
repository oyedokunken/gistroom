// Shows the last 50 session ends with their reasons, so a logout is never a mystery.
//   npm run sessions:ends
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../packages/db/src/index";

const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m?.[1] && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

const db = getDb();
const rows = await db.session.findMany({
  where: { endedAt: { not: null } },
  orderBy: { endedAt: "desc" },
  take: 50,
  select: {
    endedAt: true,
    endReason: true,
    deviceLabel: true,
    createdAt: true,
    lastSeenAt: true,
    user: { select: { username: true } },
  },
});
process.stdout.write(
  `schema ${process.env.DATABASE_SCHEMA ?? "public"}: last ${rows.length} session ends\n`,
);
for (const r of rows) {
  const lived = Math.round(((r.endedAt?.getTime() ?? 0) - r.createdAt.getTime()) / 86_400_000);
  process.stdout.write(
    `${r.endedAt?.toISOString()}  ${(r.endReason ?? "?").padEnd(16)} @${r.user.username.padEnd(20)} ${r.deviceLabel ?? "unknown"}  (${lived} days old)\n`,
  );
}
await db.$disconnect();
