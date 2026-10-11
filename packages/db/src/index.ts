import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";
export * from "./dto";
export * from "./receipts";
export * from "./unread";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * The dev and test schemas live in the same Postgres as production, and the citext and pg_trgm extensions live in
 * public. So a non public schema gets a search_path of that schema first, then public, set as a connection option.
 * Production uses the public schema as it is.
 */
export function connectionFor(url: string | undefined, schema: string | undefined) {
  if (!url || !schema || schema === "public") return { url, schema };
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-c search_path=${schema},public`);
  return { url: parsed.toString(), schema: undefined };
}

/** One shared client per process. The schema comes from DATABASE_SCHEMA (Section 5.3). */
export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const { url, schema } = connectionFor(process.env.DATABASE_URL, process.env.DATABASE_SCHEMA);
    const adapter = new PrismaPg({ connectionString: url }, schema ? { schema } : undefined);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
