import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PRESET_CATEGORIES } from "../lib/categories";

// Runs on Vercel (via vercel-build) where DATABASE_URL exists. Idempotent.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  for (const name of PRESET_CATEGORIES)
    await db.category.upsert({ where: { name }, update: {}, create: { name } });
  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

main().finally(() => db.$disconnect());
