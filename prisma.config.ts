import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations use the direct (unpooled) connection — pooled connections
    // (used at runtime, see lib/prisma.ts) can be unreliable for schema
    // changes and advisory locks.
    // Read without env() so a missing value doesn't throw when the config
    // loads: `prisma generate` doesn't need it, and Vercel Preview builds
    // don't set it (they skip migrations, see scripts/migrate-deploy.mjs).
    url: process.env.DIRECT_URL,
  },
});
