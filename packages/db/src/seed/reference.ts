import { TOPICS } from "@gistroom/shared";
import type { PrismaClient } from "../generated/client";

/**
 * Reference data the product needs to make sense, and nothing else: the eighteen topics from the shared list.
 * It only upserts, so running it twice changes nothing, and it is safe on any schema including production.
 */
export async function seedReference(db: PrismaClient): Promise<{ topics: number }> {
  for (const t of TOPICS) {
    await db.topic.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, name: t.name, description: t.description },
      update: { name: t.name, description: t.description },
    });
  }
  return { topics: TOPICS.length };
}
