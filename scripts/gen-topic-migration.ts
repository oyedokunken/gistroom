// Prints the SQL that brings the Topic table in line with packages/shared/src/topics.ts.
// Usage: npx tsx scripts/gen-topic-migration.ts > packages/db/prisma/migrations/<name>/migration.sql
import { TOPICS, TOPIC_ALIASES } from "../packages/shared/src/topics";

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;
const lines: string[] = [
  "-- Topics: one list for interests, rooms, filters and topic pages (packages/shared/src/topics.ts).",
];

for (const [oldSlug, newSlug] of Object.entries(TOPIC_ALIASES)) {
  const info = TOPICS.find((t) => t.slug === newSlug);
  if (!info) continue;
  lines.push(
    "",
    `-- ${oldSlug} became ${newSlug}. Rename in place so rooms and interests stay linked.`,
    `UPDATE "Topic" SET "slug" = ${q(newSlug)}, "name" = ${q(info.name)}, "description" = ${q(info.description)}, "updatedAt" = now()`,
    `WHERE "slug" = ${q(oldSlug)} AND NOT EXISTS (SELECT 1 FROM "Topic" WHERE "slug" = ${q(newSlug)});`,
    `UPDATE "UserInterest" SET "topicSlug" = ${q(newSlug)}`,
    `WHERE "topicSlug" = ${q(oldSlug)} AND NOT EXISTS (`,
    `  SELECT 1 FROM "UserInterest" other WHERE other."userId" = "UserInterest"."userId" AND other."topicSlug" = ${q(newSlug)}`,
    ");",
    `DELETE FROM "UserInterest" WHERE "topicSlug" = ${q(oldSlug)};`,
  );
}

lines.push("", "-- Every topic, created or brought up to date.");
lines.push(
  'INSERT INTO "Topic" ("id", "slug", "name", "description", "createdAt", "updatedAt") VALUES',
);
lines.push(
  TOPICS.map(
    (t) =>
      `  (gen_random_uuid()::text, ${q(t.slug)}, ${q(t.name)}, ${q(t.description)}, now(), now())`,
  ).join(",\n"),
);
lines.push(
  'ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "updatedAt" = now();',
);
process.stdout.write(`${lines.join("\n")}\n`);
