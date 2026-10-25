import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// A good connection to Neon (us-east-1) opens in 2–4 s from here, but roughly
// one attempt in seven hangs and never completes, through the pooler and the
// direct host alike. Waiting 20 s for those failed whole pages, so a hung
// attempt is dropped after 8 s and tried again on a fresh socket.
const CONNECT_TIMEOUT_MS = 8_000;
const CONNECT_RETRIES = 2;

const isTimeout = (err: unknown) => err instanceof Error && /timeout/i.test(err.message);

class RetryingPool extends pg.Pool {
  // pg-pool's own query() calls connect() with a callback, Prisma's transactions
  // call it without one, so both forms are kept.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connect(callback?: any): any {
    const attempt = (n: number): Promise<pg.PoolClient> =>
      super.connect().catch((err) => (n < CONNECT_RETRIES && isTimeout(err) ? attempt(n + 1) : Promise.reject(err)));
    const result = attempt(0);
    if (!callback) return result;
    result.then(
      (client) => callback(undefined, client, client.release),
      (err) => callback(err),
    );
  }
}

// Card pages fire a dozen-plus queries at once; with the pg default of 10
// connections, two pages rendering together queued long enough to time out.
// Neon's pooled URL (DATABASE_URL) is built for many short connections.
const pool = new RetryingPool({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
  connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  idleTimeoutMillis: 30_000,
  // So a socket dropped while the laptop sleeps is noticed instead of waited on.
  keepAlive: true,
});
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
