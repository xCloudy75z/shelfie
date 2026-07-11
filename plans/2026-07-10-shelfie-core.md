# Shelfie — Core (Plan 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **All agents run on Opus** (owner instruction — overrides the CLAUDE.md "build on Sonnet" rule).

**Goal:** A deployable, PIN-locked Shelfie web app where you can log a grocery purchase manually, see each item's price story with an honest "good price?" verdict, and watch the month against a budget — live on Vercel and verified.

**Architecture:** Next.js App Router with Server Components for reads and Server Actions for writes (no separate API layer). Correctness-critical logic (money, Dubai-time date bucketing, price statistics, item-name resolution) lives in pure, unit-tested modules under `lib/` so it can be TDD'd independent of the framework. Postgres (Neon) via Prisma. Money is stored as integer **fils**; dates bucket by **Asia/Dubai**.

**Tech Stack:** Next.js 15 · TypeScript (strict) · Tailwind CSS 3 · Prisma 6 + Postgres (Neon) · Vitest · `jose` (session JWT) · Node `crypto.scrypt` (PIN hash). Deployed on Vercel.

**Scope guard:** This plan is the *core happy path only*. The PDF receipt parser is Plan 2; item-merge UI, offline caching and PWA are Plan 3. The 6-table schema is created in full now so we never re-migrate.

**Working location:** Build at the repo root of `shelfie` (the `docs/` GitHub Pages hub stays untouched). Work on `main` (brand-new solo repo). Commit after every task.

---

## File Structure

```
prisma/
  schema.prisma            # 6 models: Item, Category, Purchase, Budget, Settings, ReceiptImport
  seed.ts                  # seed the preset categories
lib/
  money.ts                 # fils<->AED conversion + AED formatting
  dates.ts                 # Asia/Dubai "YYYY-MM" bucketing + today
  price-stats.ts           # unit-price stats + shelf verdict (pure, the review's #1/#5/#6/#8/#17)
  items.ts                 # normalizeName + fuzzy find-or-suggest (the review's #2/#16)
  db.ts                    # Prisma client singleton
  auth.ts                  # PIN hash/verify, session sign/verify, throttle (review #9/#18)
  categories.ts            # keyword -> category seeding helper (review #7)
app/
  layout.tsx               # root layout, fonts, theme
  globals.css              # Tailwind + design tokens (mirror docs/shelfie.css palette)
  lock/page.tsx            # PIN screen (set on first run, enter after)
  actions/auth.ts          # 'use server' — setPin, verifyPin, lock
  actions/purchases.ts     # 'use server' — addPurchase, deletePurchase, exportData
  actions/budget.ts        # 'use server' — setBudget
  (app)/layout.tsx         # authed shell with bottom tab bar
  (app)/log/page.tsx       # Log tab (manual entry)
  (app)/prices/page.tsx    # Prices tab (search + stats + shelf check)
  (app)/month/page.tsx     # Month tab (budget + category breakdown)
  components/              # TabBar, PurchaseForm, ShelfCheck, PriceCard, CategoryBars, Toast
middleware.ts              # redirect to /lock when no valid session
tests/
  money.test.ts  dates.test.ts  price-stats.test.ts  items.test.ts  auth.test.ts
```

---

## Task 0: Scaffold the Next.js app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `.env.example`, `vitest.config.ts`
- Modify: `.gitignore` (already blocks `.env`, `node_modules`, `.next`)

- [ ] **Step 1: Create the Next app in-place**

Run in the repo root (Windows: wrap in `cmd /c`):
```
cmd /c "npx create-next-app@15 . --ts --tailwind --app --no-src-dir --import-alias @/* --eslint --use-npm --no-turbopack"
```
Answer "Yes" to proceeding in a non-empty directory (docs/, plans/, .git exist). If it refuses, scaffold in a temp dir and copy `app/`, config files over — do NOT overwrite `docs/`, `plans/`, `.gitignore`, `README.md`.

- [ ] **Step 2: Add dev dependencies**

```
cmd /c "npm i prisma @prisma/client jose"
cmd /c "npm i -D vitest @types/node tsx"
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 4: Add scripts to package.json**

Ensure `"scripts"` includes:
```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"test": "vitest run",
"typecheck": "tsc --noEmit",
"db:migrate": "prisma migrate dev",
"db:seed": "tsx prisma/seed.ts",
"db:studio": "prisma studio"
```

- [ ] **Step 5: Verify it builds & commit**

Run: `cmd /c "npm run build"` — Expected: a clean production build (default template).
```
git add -A
git commit -m "chore: scaffold Next.js 15 + Tailwind + Vitest"
```

---

## Task 1: Money utilities (TDD)

**Files:**
- Create: `lib/money.ts`
- Test: `tests/money.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { filsFromAed, aedFromFils, formatAed } from "@/lib/money";

describe("money", () => {
  it("converts AED string/number to whole fils", () => {
    expect(filsFromAed("5.75")).toBe(575);
    expect(filsFromAed(5.75)).toBe(575);
    expect(filsFromAed("0.05")).toBe(5);
    expect(filsFromAed("10")).toBe(1000);
  });
  it("rounds to nearest fils (no float drift)", () => {
    expect(filsFromAed("5.999")).toBe(600);
    expect(filsFromAed("0.014")).toBe(1);
  });
  it("converts fils back to AED number", () => {
    expect(aedFromFils(575)).toBe(5.75);
  });
  it("formats fils as AED string", () => {
    expect(formatAed(575)).toBe("AED 5.75");
    expect(formatAed(100000)).toBe("AED 1,000.00");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cmd /c "npm test -- money"` → FAIL (module not found).

- [ ] **Step 3: Implement**

`lib/money.ts`:
```ts
/** All money is stored as integer fils. 1 AED = 100 fils. */
export function filsFromAed(aed: string | number): number {
  const n = typeof aed === "string" ? parseFloat(aed) : aed;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}
export function aedFromFils(fils: number): number {
  return Math.round(fils) / 100;
}
export function formatAed(fils: number): string {
  const aed = aedFromFils(fils);
  return "AED " + aed.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
```

- [ ] **Step 4: Run to verify it passes** — `cmd /c "npm test -- money"` → PASS.

- [ ] **Step 5: Commit**
```
git add lib/money.ts tests/money.test.ts
git commit -m "feat: money fils/AED utilities"
```

---

## Task 2: Dubai-time date bucketing (TDD — review finding #12)

**Files:**
- Create: `lib/dates.ts`
- Test: `tests/dates.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { dubaiMonthKey, dubaiToday, monthKeyToLabel } from "@/lib/dates";

describe("dates (Asia/Dubai)", () => {
  it("buckets a late-night purchase into the correct Dubai month", () => {
    // 2026-07-31T21:00:00Z == 2026-08-01 01:00 Dubai (+4) -> August
    expect(dubaiMonthKey(new Date("2026-07-31T21:00:00Z"))).toBe("2026-08");
    // 2026-07-31T18:00:00Z == 2026-07-31 22:00 Dubai -> July
    expect(dubaiMonthKey(new Date("2026-07-31T18:00:00Z"))).toBe("2026-07");
  });
  it("labels a month key", () => {
    expect(monthKeyToLabel("2026-07")).toBe("July 2026");
  });
  it("dubaiToday returns YYYY-MM-DD in Dubai", () => {
    expect(dubaiToday(new Date("2026-07-31T21:00:00Z"))).toBe("2026-08-01");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cmd /c "npm test -- dates"` → FAIL.

- [ ] **Step 3: Implement**

`lib/dates.ts`:
```ts
const TZ = "Asia/Dubai";
function dubaiParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: parts.year, m: parts.month, d: parts.day };
}
export function dubaiMonthKey(d: Date = new Date()): string {
  const { y, m } = dubaiParts(d);
  return `${y}-${m}`;
}
export function dubaiToday(d: Date = new Date()): string {
  const { y, m, d: day } = dubaiParts(d);
  return `${y}-${m}-${day}`;
}
export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" }) + " " + y;
}
```

- [ ] **Step 4: Run to verify it passes** — `cmd /c "npm test -- dates"` → PASS.

- [ ] **Step 5: Commit**
```
git add lib/dates.ts tests/dates.test.ts
git commit -m "feat: Asia/Dubai month bucketing"
```

---

## Task 3: Price statistics + shelf verdict (TDD — review findings #1, #5, #6, #8, #17)

**Files:**
- Create: `lib/price-stats.ts`
- Test: `tests/price-stats.test.ts`

This is the correctness heart of the app. Everything compares **unit price = totalFils / quantity**, benchmarks exclude offers and use a rolling window, and the verdict is suppressed below a minimum sample.

- [ ] **Step 1: Write the failing test**

`tests/price-stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeStats, shelfVerdict, type PurchaseInput } from "@/lib/price-stats";

const p = (o: Partial<PurchaseInput>): PurchaseInput => ({
  totalFils: 575, quantity: 1, unit: "each", onOffer: false,
  store: "Carrefour", purchasedAt: new Date("2026-07-01"), ...o,
});

describe("computeStats", () => {
  it("uses unit price, not line total (a 6-pack must not distort a single)", () => {
    const s = computeStats([
      p({ totalFils: 575, quantity: 1 }),            // 5.75/unit
      p({ totalFils: 2994, quantity: 6 }),           // 4.99/unit
    ], "each");
    expect(s!.bestFils).toBe(499);
    expect(s!.lastFils).toBe(575);       // most recent by date
    expect(s!.highestFils).toBe(575);
    expect(s!.avgFils).toBe(537);        // round((575+499)/2)
  });
  it("excludes offers from the benchmark but keeps them as all-time best display", () => {
    const s = computeStats([
      p({ totalFils: 3495, onOffer: false, purchasedAt: new Date("2026-06-01") }),
      p({ totalFils: 3495, onOffer: false, purchasedAt: new Date("2026-06-15") }),
      p({ totalFils: 3495, onOffer: false, purchasedAt: new Date("2026-07-01") }),
      p({ totalFils: 2495, onOffer: true,  purchasedAt: new Date("2026-05-01") }),
    ], "each");
    expect(s!.benchmarkBestFils).toBe(3495); // offer excluded
    expect(s!.bestFils).toBe(2495);          // all-time incl. offer, for display
  });
  it("returns null-ish sample flag below 3 non-offer buys", () => {
    const s = computeStats([p({}), p({})], "each");
    expect(s!.enoughToJudge).toBe(false);
  });
  it("only compares same unit basis", () => {
    const s = computeStats([
      p({ totalFils: 849, quantity: 1, unit: "each" }),
      p({ totalFils: 361, quantity: 0.425, unit: "kg" }), // different basis, ignored for 'each'
    ], "each");
    expect(s!.count).toBe(1);
  });
});

describe("shelfVerdict", () => {
  const stats = computeStats([
    p({ totalFils: 560, purchasedAt: new Date("2026-06-01") }),
    p({ totalFils: 560, purchasedAt: new Date("2026-06-10") }),
    p({ totalFils: 560, purchasedAt: new Date("2026-07-01") }),
    p({ totalFils: 499, onOffer: true }),
  ], "each")!;
  it("great when at/below benchmark best", () => {
    expect(shelfVerdict(560, stats).level).toBe("great");
  });
  it("pricier when clearly above average", () => {
    expect(shelfVerdict(650, stats).level).toBe("pricier");
  });
  it("suppresses when not enough data", () => {
    const thin = computeStats([p({})], "each")!;
    expect(shelfVerdict(500, thin).level).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cmd /c "npm test -- price-stats"` → FAIL.

- [ ] **Step 3: Implement**

`lib/price-stats.ts`:
```ts
export type PurchaseInput = {
  totalFils: number;
  quantity: number;
  unit: string;
  onOffer: boolean;
  store: string;
  purchasedAt: Date;
};
export type Stats = {
  unit: string;
  count: number;
  enoughToJudge: boolean;
  lastFils: number;              // unit price, most recent
  bestFils: number;              // all-time min unit price (incl. offers) — display
  benchmarkBestFils: number;     // min unit price excluding offers — for verdict
  benchmarkAvgFils: number;      // avg unit price excluding offers, windowed
  highestFils: number;
  lastStore: string;
  lastDate: Date;
};
const WINDOW_MS = 365 * 24 * 60 * 60 * 1000; // rolling 12 months for benchmark
const MIN_SAMPLE = 3;

function unitFils(p: PurchaseInput): number {
  const q = p.quantity > 0 ? p.quantity : 1;
  return Math.round(p.totalFils / q);
}

export function computeStats(all: PurchaseInput[], unit: string): Stats | null {
  const same = all.filter((p) => p.unit === unit);
  if (same.length === 0) return null;
  const byDate = [...same].sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
  const last = byDate[0];
  const units = same.map(unitFils);
  const now = byDate[0].purchasedAt.getTime();
  const bench = same.filter((p) => !p.onOffer && now - p.purchasedAt.getTime() <= WINDOW_MS);
  const benchUnits = (bench.length ? bench : same.filter((p) => !p.onOffer)).map(unitFils);
  const nonOfferCount = same.filter((p) => !p.onOffer).length;
  const avg = benchUnits.length
    ? Math.round(benchUnits.reduce((a, b) => a + b, 0) / benchUnits.length)
    : Math.round(units.reduce((a, b) => a + b, 0) / units.length);
  return {
    unit,
    count: same.length,
    enoughToJudge: nonOfferCount >= MIN_SAMPLE,
    lastFils: unitFils(last),
    bestFils: Math.min(...units),
    benchmarkBestFils: benchUnits.length ? Math.min(...benchUnits) : Math.min(...units),
    benchmarkAvgFils: avg,
    highestFils: Math.max(...units),
    lastStore: last.store,
    lastDate: last.purchasedAt,
  };
}

export type Verdict = { level: "great" | "cheaper" | "same" | "pricier" | "unknown"; label: string };
export function shelfVerdict(shelfFils: number, s: Stats): Verdict {
  if (!s.enoughToJudge) return { level: "unknown", label: "Only a few past prices — not enough to judge" };
  const best = s.benchmarkBestFils, avg = s.benchmarkAvgFils;
  if (shelfFils <= best * 1.03) return { level: "great", label: "Great price — at or below your best" };
  if (shelfFils < avg * 0.97) return { level: "cheaper", label: "Cheaper than usual" };
  if (shelfFils <= avg * 1.03) return { level: "same", label: "About the same as usual" };
  return { level: "pricier", label: "Pricier than usual — maybe wait" };
}
```

- [ ] **Step 4: Run to verify it passes** — `cmd /c "npm test -- price-stats"` → PASS.

- [ ] **Step 5: Commit**
```
git add lib/price-stats.ts tests/price-stats.test.ts
git commit -m "feat: unit-price stats + honest shelf verdict"
```

---

## Task 4: Item name resolution (TDD — review findings #2, #16)

**Files:**
- Create: `lib/items.ts`
- Test: `tests/items.test.ts`

Keeps item identity clean without a heavy engine: normalize, then Levenshtein-ratio match against existing items; return `exact | suggest | new`.

- [ ] **Step 1: Write the failing test**

`tests/items.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeName, resolveItem } from "@/lib/items";

const existing = [
  { id: "1", name: "Almarai Milk 2L" },
  { id: "2", name: "Brown Bread" },
];

describe("items", () => {
  it("normalizes case/punctuation/whitespace", () => {
    expect(normalizeName("  Almarai  MILK 2L! ")).toBe("almarai milk 2l");
  });
  it("returns exact match on normalized equality", () => {
    expect(resolveItem("almarai milk 2l", existing)).toEqual({ kind: "exact", item: existing[0] });
  });
  it("suggests a close match instead of creating a junk item", () => {
    const r = resolveItem("almarai milk 2ltr", existing); // typo/variant
    expect(r.kind).toBe("suggest");
    if (r.kind === "suggest") expect(r.item.id).toBe("1");
  });
  it("treats a clearly different name as new", () => {
    expect(resolveItem("chicken breast", existing).kind).toBe("new");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cmd /c "npm test -- items"` → FAIL.

- [ ] **Step 3: Implement**

`lib/items.ts`:
```ts
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}
function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - lev(a, b) / max;
}
export type ItemRef = { id: string; name: string };
export type Resolution =
  | { kind: "exact"; item: ItemRef }
  | { kind: "suggest"; item: ItemRef; score: number }
  | { kind: "new" };

export function resolveItem(rawName: string, existing: ItemRef[], threshold = 0.82): Resolution {
  const norm = normalizeName(rawName);
  for (const e of existing) if (normalizeName(e.name) === norm) return { kind: "exact", item: e };
  let best: ItemRef | null = null, bestScore = 0;
  for (const e of existing) {
    const sc = ratio(norm, normalizeName(e.name));
    if (sc > bestScore) { bestScore = sc; best = e; }
  }
  if (best && bestScore >= threshold) return { kind: "suggest", item: best, score: bestScore };
  return { kind: "new" };
}
```

- [ ] **Step 4: Run to verify it passes** — `cmd /c "npm test -- items"` → PASS.

- [ ] **Step 5: Commit**
```
git add lib/items.ts tests/items.test.ts
git commit -m "feat: item name resolution (exact/suggest/new)"
```

---

## Task 5: Prisma schema + Neon + seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `lib/db.ts`, `lib/categories.ts`
- Modify: `.env` (Neon `DATABASE_URL`, `DIRECT_URL`) — never committed

- [ ] **Step 1: Provision Neon** — Create a Neon project `shelfie` (Frankfurt). Put pooled URL in `DATABASE_URL`, direct URL in `DIRECT_URL` in `.env`. Add both to `.env.example` as placeholders.

- [ ] **Step 2: Write the schema**

`prisma/schema.prisma`:
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }

model Category {
  id    String @id @default(cuid())
  name  String @unique
  items Item[]
}
model Item {
  id         String     @id @default(cuid())
  name       String     @unique
  normalized String     @index
  categoryId String?
  category   Category?  @relation(fields: [categoryId], references: [id])
  purchases  Purchase[]
  createdAt  DateTime   @default(now())
}
model Purchase {
  id          String   @id @default(cuid())
  itemId      String
  item        Item     @relation(fields: [itemId], references: [id])
  totalFils   Int
  quantity    Float    @default(1)
  unit        String   @default("each")
  store       String   @default("Carrefour")
  onOffer     Boolean  @default(false)
  purchasedAt DateTime                       // stored as instant; bucketed via Asia/Dubai
  monthKey    String   @index                // "YYYY-MM" in Dubai time, denormalized for Month tab
  importId    String?
  import      ReceiptImport? @relation(fields: [importId], references: [id])
  createdAt   DateTime @default(now())
  @@index([itemId])
}
model Budget {
  id        String @id @default(cuid())
  monthKey  String @unique                   // "YYYY-MM"
  amountFils Int
}
model ReceiptImport {                          // used by Plan 2; created now to avoid re-migration
  id          String     @id @default(cuid())
  fingerprint String     @unique
  store       String
  totalFils   Int
  importedAt  DateTime   @default(now())
  purchases   Purchase[]
}
model Settings {
  id             Int      @id @default(1)
  pinHash        String?
  pinSalt        String?
  failedAttempts Int      @default(0)
  lockedUntil    DateTime?
}
```

- [ ] **Step 3: Prisma client singleton**

`lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
```

- [ ] **Step 4: Category keyword seeder**

`lib/categories.ts`:
```ts
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
```

- [ ] **Step 5: Seed script**

`prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { PRESET_CATEGORIES } from "../lib/categories";
const db = new PrismaClient();
async function main() {
  for (const name of PRESET_CATEGORIES)
    await db.category.upsert({ where: { name }, update: {}, create: { name } });
  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}
main().finally(() => db.$disconnect());
```

- [ ] **Step 6: Migrate + seed + commit**

```
cmd /c "npx prisma migrate dev --name init"
cmd /c "npm run db:seed"
```
Expected: migration applied, 6 categories + settings row created.
```
git add prisma lib/db.ts lib/categories.ts .env.example
git commit -m "feat: prisma schema (6 tables) + seed"
```

---

## Task 6: PIN auth — hash, session, throttle (TDD for crypto — review #9, #18)

**Files:**
- Create: `lib/auth.ts`, `app/actions/auth.ts`, `app/lock/page.tsx`, `middleware.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Write the failing test (pure crypto helpers)**

`tests/auth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPin, verifyPin } from "@/lib/auth";

describe("pin hashing", () => {
  it("verifies a correct pin and rejects a wrong one", async () => {
    const { hash, salt } = await hashPin("1234");
    expect(await verifyPin("1234", hash, salt)).toBe(true);
    expect(await verifyPin("9999", hash, salt)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cmd /c "npm test -- auth"` → FAIL.

- [ ] **Step 3: Implement auth lib**

`lib/auth.ts`:
```ts
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";
const scryptAsync = promisify(scrypt);
const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "dev-only-secret-change-me");

export async function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(pin, salt, 64)) as Buffer;
  return { hash: buf.toString("hex"), salt };
}
export async function verifyPin(pin: string, hash: string, salt: string) {
  const buf = (await scryptAsync(pin, salt, 64)) as Buffer;
  const known = Buffer.from(hash, "hex");
  return buf.length === known.length && timingSafeEqual(buf, known);
}
export async function makeSession() {
  return new SignJWT({ ok: true }).setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d").sign(secret);
}
export async function readSession(token?: string) {
  if (!token) return false;
  try { await jwtVerify(token, secret); return true; } catch { return false; }
}
```

- [ ] **Step 4: Run to verify it passes** — `cmd /c "npm test -- auth"` → PASS.

- [ ] **Step 5: Auth server actions (throttle in DB)**

`app/actions/auth.ts`:
```ts
"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPin, verifyPin, makeSession } from "@/lib/auth";

export async function setPin(pin: string) {
  const { hash, salt } = await hashPin(pin);
  await db.settings.update({ where: { id: 1 }, data: { pinHash: hash, pinSalt: salt } });
  (await cookies()).set("shelfie_session", await makeSession(), { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 7, path: "/" });
  redirect("/log");
}
export async function verifyPinAction(pin: string) {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  if (!s?.pinHash) return { ok: false, error: "No PIN set" };
  if (s.lockedUntil && s.lockedUntil > new Date()) return { ok: false, error: "Too many attempts. Try again shortly." };
  const ok = await verifyPin(pin, s.pinHash, s.pinSalt!);
  if (!ok) {
    const attempts = s.failedAttempts + 1;
    await db.settings.update({ where: { id: 1 }, data: {
      failedAttempts: attempts,
      lockedUntil: attempts >= 5 ? new Date(Date.now() + 60_000) : null,
    }});
    return { ok: false, error: "Wrong PIN" };
  }
  await db.settings.update({ where: { id: 1 }, data: { failedAttempts: 0, lockedUntil: null } });
  (await cookies()).set("shelfie_session", await makeSession(), { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 7, path: "/" });
  return { ok: true };
}
export async function lock() {
  (await cookies()).delete("shelfie_session");
  redirect("/lock");
}
```

- [ ] **Step 6: Middleware guard**

`middleware.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth";
export async function middleware(req: NextRequest) {
  const authed = await readSession(req.cookies.get("shelfie_session")?.value);
  const isLock = req.nextUrl.pathname.startsWith("/lock");
  if (!authed && !isLock) return NextResponse.redirect(new URL("/lock", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next|favicon|manifest|.*\\.).*)"] };
```

- [ ] **Step 7: Lock page (set-on-first-run + enter)**

`app/lock/page.tsx` — a client component with a 4-dot PIN pad (mirror `docs/mockup.html` lock UI). On first run (no PIN in Settings — pass a server prop), it calls `setPin`; otherwise `verifyPinAction`, then `router.push("/log")` on success, showing the throttle error on failure.

- [ ] **Step 8: Manual verify + commit**

Run `cmd /c "npm run dev"`, open `/` → redirected to `/lock` → set a PIN → land on `/log`. Reload → still in (session cookie). 
```
git add lib/auth.ts app/actions/auth.ts app/lock middleware.ts tests/auth.test.ts
git commit -m "feat: PIN auth with throttle + httpOnly session"
```

---

## Task 7: App shell + tab bar

**Files:**
- Create: `app/(app)/layout.tsx`, `app/components/TabBar.tsx`, update `app/globals.css` with the design tokens from `docs/shelfie.css`.

- [ ] **Step 1:** Port the palette + fonts (Fraunces / Hanken Grotesk / Spline Sans Mono via `next/font/google`) and light/dark tokens into `globals.css` / `layout.tsx`, matching the approved mockup.
- [ ] **Step 2:** `app/(app)/layout.tsx` renders children + a fixed bottom `TabBar` (Log / Prices / Month) with the SVG icons from the mockup and a theme toggle.
- [ ] **Step 3:** Verify `/log`, `/prices`, `/month` route and the tab bar highlights the active tab. Commit `feat: authed app shell + tab bar`.

---

## Task 8: Log tab — manual purchase entry

**Files:**
- Create: `app/(app)/log/page.tsx`, `app/components/PurchaseForm.tsx`, `app/actions/purchases.ts`

- [ ] **Step 1: addPurchase server action**

`app/actions/purchases.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { filsFromAed } from "@/lib/money";
import { normalizeName, resolveItem } from "@/lib/items";
import { dubaiMonthKey } from "@/lib/dates";
import { guessCategory } from "@/lib/categories";

export async function addPurchase(input: {
  itemName: string; priceAed: string; quantity: number; unit: string;
  store: string; onOffer: boolean; categoryName?: string; confirmNewItem?: boolean;
}) {
  const existing = await db.item.findMany({ select: { id: true, name: true } });
  const res = resolveItem(input.itemName, existing);
  let itemId: string;
  if (res.kind === "exact") itemId = res.item.id;
  else if (res.kind === "suggest" && !input.confirmNewItem)
    return { needsConfirm: true, suggestion: res.item }; // client asks "is this <name>?"
  else {
    const catName = input.categoryName || guessCategory(input.itemName);
    const cat = await db.category.upsert({ where: { name: catName }, update: {}, create: { name: catName } });
    const item = await db.item.create({ data: {
      name: input.itemName.trim(), normalized: normalizeName(input.itemName), categoryId: cat.id,
    }});
    itemId = item.id;
  }
  const now = new Date();
  await db.purchase.create({ data: {
    itemId, totalFils: filsFromAed(input.priceAed), quantity: input.quantity || 1,
    unit: input.unit || "each", store: input.store || "Carrefour", onOffer: input.onOffer,
    purchasedAt: now, monthKey: dubaiMonthKey(now),
  }});
  revalidatePath("/month"); revalidatePath("/prices");
  return { ok: true };
}
export async function exportData() { /* Task 10 */ }
```

- [ ] **Step 2:** `PurchaseForm.tsx` (client) mirrors the mockup Log form: item input with `<datalist>` from existing items, price, qty, store (default Carrefour), category (auto), on-offer toggle. On submit calls `addPurchase`; if `needsConfirm`, shows "Is this **<suggestion>**? [Yes, same] [No, new item]".
- [ ] **Step 3:** `/log` server component fetches item names for autocomplete, renders `PurchaseForm`. Toast on success; form clears.
- [ ] **Step 4:** Manual verify: add "Milk 2L @ 5.75" → appears in Month recent. Add "milk 2l" → prompts "Is this Milk 2L?". Commit `feat: manual purchase logging with item-identity confirm`.

---

## Task 9: Prices + Month tabs

**Files:**
- Create: `app/(app)/prices/page.tsx`, `app/(app)/month/page.tsx`, `app/components/{PriceCard,ShelfCheck,CategoryBars}.tsx`, `app/actions/budget.ts`

- [ ] **Step 1: Prices page** — search/select an item; load its purchases; `computeStats`; render Last/Best/Avg/Highest (with store+date), the `<ShelfCheck>` client input calling `shelfVerdict`, and recent buys. Show the "not enough to judge" state when `enoughToJudge` is false.
- [ ] **Step 2: setBudget action** — `app/actions/budget.ts`: upsert `Budget` by `monthKey` (default a new month to the previous month's amount — review #15).
- [ ] **Step 3: Month page** — current `dubaiMonthKey`; sum purchases where `monthKey` matches; compare to budget (handle no-budget: show CTA, no pace color — review #14); category breakdown by joining Item.category; recent purchases; prev/next month nav.
- [ ] **Step 4:** Manual verify against the mockup for both tabs. Commit `feat: prices + month tabs`.

---

## Task 10: Data export + deploy + verify (review #10)

**Files:**
- Modify: `app/actions/purchases.ts` (`exportData`), `app/(app)/month/page.tsx` (export button)

- [ ] **Step 1: exportData** — server action returning JSON of all items, purchases (AED + fils), budgets; a client button triggers a `Blob` download `shelfie-export-<date>.json`.
- [ ] **Step 2: Deploy to Vercel** — `cmd /c "npx vercel --prod"`; set env vars `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` in the Vercel dashboard (never via PowerShell stdin — CRLF bug). Run `prisma migrate deploy` in the build (`"build": "prisma generate && prisma migrate deploy && next build"`).
- [ ] **Step 3: Verify the LIVE app (not tests):**
  - [ ] Visiting the URL redirects to `/lock`; set PIN; land on Log.
  - [ ] Add a purchase → appears in Month; add a near-duplicate name → identity confirm fires.
  - [ ] Prices shows a verdict for an item with ≥3 buys; shows "not enough" for a new one.
  - [ ] Month shows spend vs budget with correct Dubai-month bucketing across a boundary.
  - [ ] Export downloads valid JSON.
  - [ ] `cmd /c "npm test"` → all suites green; `cmd /c "npm run typecheck"` → clean.
- [ ] **Step 4: Commit + tag** `git commit -m "feat: data export + production deploy"` and update the hub's "Live App" card to Ready with the URL.

**STOP here and check in with the owner** before Plan 2 (receipt parser), per the build-cadence rule.

---

## Self-Review (completed by author)

- **Spec coverage:** Log (manual) ✅ T8 · Prices + verdict ✅ T3/T9 · Month + budget ✅ T9 · PIN + throttle + session ✅ T6 · unit-price/offer/min-sample/window ✅ T3 · item identity + suggest ✅ T4/T8 · Dubai buckets ✅ T2/T8 · category auto ✅ T5/T8 · export ✅ T10 · Deploy+verify ✅ T10. Receipt import (draft-review, dedupe, bulk-tag) and item-merge UI are intentionally **Plan 2/3** — the `ReceiptImport` table + `importId` are stubbed in now to avoid re-migration.
- **Placeholder scan:** `exportData` is stubbed in T8 and implemented in T10 (cross-referenced), not a silent TODO. No other placeholders.
- **Type consistency:** `PurchaseInput`/`Stats`/`Verdict` (T3), `Resolution` (T4), `hashPin/verifyPin/makeSession/readSession` (T6), `addPurchase` shape (T8) are used consistently across tasks.
```

---

## Task 11: Version stamp + one-tap Update + installable PWA (owner request 2026-07-11)

**Goal:** The home-screen app always loads the latest deploy (no reinstall), shows a clear version timestamp, and offers a one-tap "Update" that force-checks the server and reloads.

**Files:**
- Modify: `next.config.mjs` (inject build id + build time), `app/(app)/month/page.tsx` (mount VersionBar)
- Create: `app/version/route.ts`, `app/components/VersionBar.tsx`, `app/components/ServiceWorkerRegister.tsx`, `public/manifest.webmanifest`, `public/sw.js`; link manifest + register SW in `app/layout.tsx`.

- [ ] **Step 1: Inject the build stamp.** In `next.config.mjs` add:
```js
env: {
  NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
  NEXT_PUBLIC_BUILT_AT: new Date().toISOString(), // evaluated when `next build` runs
},
```

- [ ] **Step 2: `/version` endpoint reflecting the DEPLOYED build.** `app/version/route.ts`:
```ts
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID, builtAt: process.env.NEXT_PUBLIC_BUILT_AT },
    { headers: { "cache-control": "no-store" } },
  );
}
```

- [ ] **Step 3: `VersionBar.tsx` (client).** Shows `Version <NEXT_PUBLIC_BUILT_AT formatted in Asia/Dubai> · <NEXT_PUBLIC_BUILD_ID>` using the mono font. An **Update** button: `const r = await fetch("/version", { cache: "no-store" }).then(x=>x.json())`; if `r.buildId !== process.env.NEXT_PUBLIC_BUILD_ID` → set label "Update available — tap to reload", and on tap: if `navigator.serviceWorker` exists, `getRegistrations()` → `reg.update()`/`unregister()` then `location.reload()`; else `location.reload()`. If equal → transient "You're on the latest ✓". Format the timestamp with `Intl.DateTimeFormat("en-GB",{ timeZone:"Asia/Dubai", dateStyle:"medium", timeStyle:"short" })`.

- [ ] **Step 4: `manifest.webmanifest`** in `public/`: name "Shelfie", short_name "Shelfie", `start_url:"/"`, `display:"standalone"`, `theme_color:"#1f9d57"`, `background_color:"#f4f1e8"`, at least one 512×512 maskable icon (generate a simple green 🛒 icon PNG or an inline SVG-based icon). Link it in `app/layout.tsx` (`<link rel="manifest" href="/manifest.webmanifest">`, `<meta name="theme-color">`, apple-touch-icon).

- [ ] **Step 5: `public/sw.js` — network-first, never stale.**
```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
```
No precache of the app shell (avoids trapping an old version). `ServiceWorkerRegister.tsx` (client, mounted in `app/layout.tsx`, production-only) registers `/sw.js`.

- [ ] **Step 6:** Mount `<VersionBar/>` at the bottom of the Month tab.

- [ ] **Step 7: Verify** `npm run typecheck`, `npm test` (still green), `npm run build` (DB-free; `/version` route listed). Commit `feat: version stamp + one-tap update + installable PWA`.

**Design intent:** network-first SW + `skipWaiting` means the installed shortcut always loads the newest deploy — add-to-home-screen once, updates forever. The stamp identifies the running version; the Update button is a guaranteed manual force. This fully covers the owner's request; deeper offline caching stays in Plan 3.
