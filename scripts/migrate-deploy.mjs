// Runs `prisma migrate deploy` during the build, except on Vercel Preview and
// Development builds. Preview shares the production database, so migrations
// from an unmerged branch must never run there; they apply when the branch
// reaches production. Local builds (no VERCEL_ENV) still migrate as before.
import { execSync } from "node:child_process";

const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv && vercelEnv !== "production") {
  console.log(`Skipping prisma migrate deploy (VERCEL_ENV=${vercelEnv}).`);
} else {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
