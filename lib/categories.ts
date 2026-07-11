export const PRESET_CATEGORIES = ["Dairy", "Produce", "Bakery", "Household", "Snacks", "Groceries"];

const KEYWORDS: Record<string, string> = {
  milk: "Dairy", laban: "Dairy", cream: "Dairy", yog: "Dairy", cheese: "Dairy",
  bread: "Bakery", bun: "Bakery", croissant: "Bakery",
  banana: "Produce", apple: "Produce", tomato: "Produce", eggplant: "Produce", onion: "Produce",
  detergent: "Household", tissue: "Household", soap: "Household",
  chips: "Snacks", chocolate: "Snacks", gum: "Snacks", biscuit: "Snacks",
};

export function guessCategory(name: string): string {
  const n = name.toLowerCase();
  for (const k in KEYWORDS) if (n.includes(k)) return KEYWORDS[k];
  return "Groceries";
}
