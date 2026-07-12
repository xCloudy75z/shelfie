"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeCategoryName, isReservedCategoryName } from "@/lib/categories";

type Ok = { ok: true };
type Err = { error: string };

async function nameError(name: string, excludeId?: string): Promise<string | null> {
  if (isReservedCategoryName(name)) return `"${name}" is a reserved name.`;
  const clash = await db.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  return clash ? `A category called "${name}" already exists.` : null;
}

export async function createCategory(raw: string): Promise<(Ok & { id: string }) | Err> {
  const name = normalizeCategoryName(raw);
  if (!name) return { error: "Enter a category name." };
  const err = await nameError(name);
  if (err) return { error: err };
  const cat = await db.category.create({ data: { name }, select: { id: true } });
  revalidatePath("/month"); revalidatePath("/prices"); revalidatePath("/log");
  return { ok: true, id: cat.id };
}

export async function renameCategory(id: string, raw: string): Promise<Ok | Err> {
  const name = normalizeCategoryName(raw);
  if (!name) return { error: "Enter a category name." };
  const err = await nameError(name, id);
  if (err) return { error: err };
  await db.category.update({ where: { id }, data: { name } });
  revalidatePath("/month"); revalidatePath("/prices"); revalidatePath("/log");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<{ ok: true; movedToUncategorized: number } | Err> {
  const moved = await db.$transaction(async (tx) => {
    const res = await tx.item.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await tx.category.delete({ where: { id } });
    return res.count;
  });
  revalidatePath("/month"); revalidatePath("/prices"); revalidatePath("/log");
  return { ok: true, movedToUncategorized: moved };
}

export async function setItemCategory(itemId: string, categoryId: string | null): Promise<Ok | Err> {
  if (categoryId) {
    const exists = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) return { error: "That category no longer exists." };
  }
  await db.item.update({ where: { id: itemId }, data: { categoryId } });
  revalidatePath("/month"); revalidatePath("/prices");
  return { ok: true };
}
