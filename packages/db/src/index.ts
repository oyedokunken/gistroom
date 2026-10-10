import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** One shared client per process. The schema comes from DATABASE_SCHEMA (Section 5.3). */
export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(
      { connectionString: process.env.DATABASE_URL },
      { schema: process.env.DATABASE_SCHEMA },
    );
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}
