"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { filsFromAed } from "@/lib/money";

/**
 * Set (or change) the budget for a month. Upserts a single Budget row keyed by
 * the "YYYY-MM" Dubai month key; the AED string is stored as integer fils.
 * A month with no explicit budget simply has no row — the Month tab defaults its
 * displayed target to the previous month's budget without creating anything here.
 */
export async function setBudget(monthKey: string, amountAed: string) {
  const amountFils = filsFromAed(amountAed);
  await db.budget.upsert({
    where: { monthKey },
    update: { amountFils },
    create: { monthKey, amountFils },
  });
  revalidatePath("/month");
}
