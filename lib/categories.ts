export const PRESET_CATEGORIES = ["Dairy", "Produce", "Bakery", "Household", "Snacks", "Groceries"];

const KEYWORDS: Record<string, string> = {
  milk: "Dairy", laban: "Dairy", cream: "Dairy", yog: "Dairy", cheese: "Dairy",
  bread: "Bakery", bun: "Bakery", croissant: "Bakery",
  banana: "Produce", apple: "Produce", tomato: "Produce", eggplant: "Produce", onion: "Produce",
  detergent: "Household", tissue: "Household", soap: "Household",
  chips: "Snacks", chocolate: "Snacks", gum: "Snacks", biscuit: "Snacks",
};

/** Best-effort category from an item name, or null when nothing matches
 *  (null files as "Uncategorized" so mis-files are visible, not hidden in Groceries). */
export function guessCategory(name: string): string | null {
  const n = name.toLowerCase();
  for (const k in KEYWORDS) if (n.includes(k)) return KEYWORDS[k];
  return null;
}

const RESERVED = new Set(["uncategorized", "other"]);

/** Trim + collapse inner whitespace; null if empty. */
export function normalizeCategoryName(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, " ");
  return n.length === 0 ? null : n;
}

/** True for names reserved by the app (the null-category label). Case-insensitive. */
export function isReservedCategoryName(name: string): boolean {
  return RESERVED.has(name.trim().toLowerCase());
}
