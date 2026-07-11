import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 is engine-less: the client connects through a driver adapter.
// PrismaPg + PrismaClient construct lazily — no DB connection happens until a
// query runs, so importing this module during `next build` is safe with no DB.
const g = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = g.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
