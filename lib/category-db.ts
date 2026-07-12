import type { PrismaClient, Prisma } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Find a category by name CASE-INSENSITIVELY, else create it. Prevents the
 * case-variant duplicates the old case-sensitive upsert allowed (break-spec F5).
 * Returns the category id.
 */
export async function findOrCreateCategory(client: Client, name: string): Promise<string> {
  const existing = await client.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await client.category.create({ data: { name }, select: { id: true } });
  return created.id;
}
