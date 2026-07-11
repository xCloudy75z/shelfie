import { defineConfig } from "prisma/config";

// Prisma 7 moved connection URLs out of schema.prisma into this file.
// Migrations (prisma migrate deploy on Vercel) use the direct, unpooled URL.
// The runtime client uses the pooled DATABASE_URL via the pg adapter (lib/db.ts).
// NOTE: we read process.env directly (not the `env()` helper) so that offline
// commands like `prisma migrate diff` don't throw when DIRECT_URL is unset locally.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
