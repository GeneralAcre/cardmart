import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Card pages fire a dozen-plus queries at once; with the pg default of 10
// connections, two pages rendering together queued long enough to time out.
// Neon's pooled URL (DATABASE_URL) is built for many short connections.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
  connectionTimeoutMillis: 20_000,
  idleTimeoutMillis: 30_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
