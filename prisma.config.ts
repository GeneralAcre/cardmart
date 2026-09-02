import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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
    url: env("DIRECT_URL"),
  },
});
