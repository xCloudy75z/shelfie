# 🛒 Shelfie — Master Documentation

**A complete, exhaustive reference for the Shelfie project.** Written as a hand-off document so another person or AI can pick up the project with full context — nothing assumed, nothing left out.

- **Live app:** https://shelfie-gamma-seven.vercel.app
- **Project hub (design/review/progress):** https://xcloudy75z.github.io/shelfie/
- **GitHub repo (public):** https://github.com/xCloudy75z/shelfie
- **Local path:** `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie`
- **Owner:** Abdulla (UAE). Non-technical founder; provides direction, AI implements.
- **Status at time of writing:** Core app (Plan 1) fully shipped & live. **Receipt import (Plan 2) now works end-to-end on Vercel** (server-side PDF read fixed 2026-07-12 — see §15.5). **Receipt Import v2** (barcode identity, per-item offers, accuracy self-check) is designed and awaiting approval — see `docs/superpowers/specs/2026-07-12-receipt-import-v2-design.md`.

---

## Table of Contents
1. What Shelfie is
2. Current status (what works / what's broken)
3. How we work (rules & operating model)
4. The Project Hub (GitHub Pages) — structure & organisation
5. Design system (aesthetic, fonts, colours, UX tokens)
6. Architecture & tech stack
7. Environment, config & the Windows toolchain
8. Data model (database schema)
9. Features in detail (the 3 tabs + everything else)
10. Locked design decisions
11. The adversarial review (18 findings)
12. File-by-file reference
13. Build history (Plan 1 + Plan 2, every task & commit)
14. How to run, deploy & verify
15. **The receipt-import debugging saga (7 attempts, none fixed it)**
16. Known issues & recommended next steps

---

## 1. What Shelfie is

Shelfie is a **deliberately simple, single-user UAE grocery price + budget tracker**. It is a ground-up rebuild of an older, over-built app ("FilsWise", which had 20 DB tables, an offer-authenticity engine, trips with merge/split, multiple AI "coach" engines, alerts/SSE, barcode scanning, watchlists, Excel export, portal SSO/multi-user). The brief for Shelfie was **"a finer, and much simpler version"** — keep only the load-bearing core.

**The one-line pitch:** *"Standing at the shelf — is this price actually good, or have I paid less before?"*

It serves three real moments:
- 🛒 **At the shelf** → check if a price is good (the **Prices** tab).
- 🧾 **After shopping** → log what you bought, fast (the **Log** tab, incl. PDF receipt import).
- 📅 **End of month** → spend vs budget, where it went (the **Month** tab).

**The whole app is 3 tabs, one 4-digit PIN, ~6 database tables.** Everything the old app over-built was deliberately dropped.

---

## 2. Current status

### ✅ Working (live in production)
- PIN lock (set on first run, enter thereafter) with brute-force throttle + 7-day session.
- **Log tab** — manual purchase entry with a mobile typeahead, item-identity confirmation, price validation.
- **Prices tab** — per-item price story (last/best/avg/highest), "is this shelf price good?" verdict; loads instantly on item select.
- **Month tab** — spend vs budget with green/amber/red pace, category breakdown, editable/deletable purchases, month nav, **pay-cycle month bucketing (25th → 24th)**.
- **Backup & Restore** — validated JSON export/import with snapshot+undo, "last backed up" status + nudge.
- **Auto-update + version stamp** card; **installable PWA** with real PNG icons.
- All data scoped to one owner; Neon Postgres (Frankfurt); auto-deploy on every push to `main`.
- **54 unit tests** green; three code-review passes (one adversarial pre-build, one on the lib foundation, one final).
- **Receipt PDF import** — **working end-to-end on Vercel** (server-side Node read; fixed 2026-07-12, see §15.5). Upload the Carrefour PDF → server parses → review list with a green "Total matches ✓" → save.

### ❌ Broken / incomplete
- **None currently.** The last open problem — receipt import — was fixed on 2026-07-12 (§15.5). The next planned work is **Receipt Import v2** (barcode identity, per-item offers, accuracy self-check): designed and awaiting owner approval (`docs/superpowers/specs/2026-07-12-receipt-import-v2-design.md`).

---

## 3. How we work (rules & operating model)

These are hard rules for this project — follow them exactly.

### 3.1 Model policy
- **ALL OPUS, NO SONNET.** Every step, and every spawned sub-agent / workflow agent, runs on Claude Opus. This overrides the general "build on Sonnet" convention. When dispatching subagents, pass the Opus model explicitly.

### 3.2 The owner is remote — everything reviewable must be a live web page
- The owner works from a **Claude Code remote session**, not the physical PC. He **cannot see local files, the preview pane, or MCP widgets** — only real web pages.
- **Nothing is "approved" until he has seen it with his own eyes in a browser.** He loves HTML pages with clickable buttons.
- Therefore: **anything for him to review (mockups, spec, review findings, progress, this doc) is published as HTML on GitHub Pages** and he's given the URL. Never rely on local files / the preview pane / pasted specs.
- In-chat interactive option prompts (multiple-choice questions) DO work for him — use them for decisions.

### 3.3 Privacy is top-critical (absolute rule)
- **Never read, recognise, or save the owner's personal data** — name, card/loyalty numbers, email, phone, address, transaction/receipt IDs, cashier, etc. Stated with explicit warning of "severe consequences".
- If personal data is ever crossed, **delete the derivative immediately** and do NOT save any of it to memory.
- When a file may contain personal data (e.g. a receipt PDF), **do NOT open it raw.** Extract only the non-personal structure via a script that redacts/masks/whitelists *before* it's ever seen (the technique used: `pdftotext -layout` → keep only product/price/structural lines → mask any digit run ≥7 (cards/phones/barcodes) → drop email/personal-keyword lines → delete the raw extraction immediately). Product names and prices are NOT personal; his identity is.
- The repo contains only code + mockups — **never real receipts, spending data, databases, or secrets** (hard-blocked in `.gitignore`).

### 3.4 The superpowers workflow (how features get built)
Every feature follows this sequence (the "superpowers" skill set):
1. **Brainstorming** — turn the idea into a design through one-question-at-a-time dialogue; YAGNI ruthlessly; propose 2–3 approaches; present a design; get approval. No code until the design is approved.
2. **Writing the spec** → a design doc.
3. **Writing the plan** → a detailed, bite-sized, test-first implementation plan (`plans/*.md`).
4. **Subagent-driven development** → a **fresh Opus subagent per task**, each doing strict **TDD** (write failing test → run → implement → pass → commit), followed by review.
5. **Verification before completion** → run the real thing, show evidence; never claim "done" without confirming.
6. **Systematic debugging** → for any bug, find the ROOT CAUSE before any fix (see §15 for a textbook application).
7. **Requesting code review** → adversarial reviews at checkpoints.

### 3.5 Build cadence (mandatory)
Never build every phase in one autonomous run. Build the **foundation + core happy-path first**, package it into a runnable artifact **early**, **verify the real artifact runs** (not just tests), then **stop and check in** with the owner before layering more. Shelfie's core was deployed live and verified before extra features were added.

### 3.6 Way of working with the owner
- Plain English first; explain the *why* then the *what*; short, scannable messages.
- Present real, clickable things (published to the hub) — don't just describe.
- Use in-chat multiple-choice questions for decisions.
- A live **progress board** (see §4) shows tasks flipping green in real time.
- Be honest about failures; show evidence; don't over-promise.

---

## 4. The Project Hub (GitHub Pages)

The hub is a small static site served by **GitHub Pages from the repo's `/docs` folder** on the `main` branch (enabled via the GitHub Pages API; URL `https://xcloudy75z.github.io/shelfie/`). It exists because the owner can only review things as live web pages (§3.2). Every push to `main` rebuilds it.

### 4.1 Pages (all under `/docs`)
| File | URL | Purpose |
|------|-----|---------|
| `index.html` | `/` | **The hub / front door.** A hero + a grid of clickable cards, one per artifact, each with a status badge. |
| `mockup.html` | `/mockup.html` | **Interactive clickable mockup** of the whole app (fake sample groceries) — PIN pad, 3 tabs, the receipt-import flow, the shelf-price verdict. Built before any real code, to lock the look & flow. |
| `spec.html` | `/spec.html` | **The design spec** in plain English — what's in, what's deliberately cut, the receipt parser, the tech; hardened by the adversarial review. |
| `review.html` | `/review.html` | **The adversarial review** — 18 findings (rendered from a JS data array), each with severity, failure scenario, minimum fix, and an "adopted / noted" verdict. |
| `progress.html` | `/progress.html` | **Live build-progress board.** A `<meta http-equiv="refresh" content="60">` auto-refreshes it every 60s; a JS `TASKS` array drives a progress bar + a status chip (done ✓ / building ◐ / queued) per task. Reframed per phase (Plan 1 core → Plan 2 receipt import). |
| `MASTER-DOCUMENTATION.md` | `/MASTER-DOCUMENTATION.md` | **This document** (raw markdown, served by Pages). |
| `masterdoc.html` | `/masterdoc.html` | A rendered, readable view of this document. |

### 4.2 Shared assets
- `shelfie.css` — the shared design system (tokens, light/dark, components, the receipt-perforation divider, the theme toggle button, the `rise` load animation). Linked by every hub page.
- `theme.js` — persistent light/dark toggle (reads `localStorage('shelfie-theme')` / `prefers-color-scheme`, sets `data-theme` on `<html>`; a no-flash inline `<head>` snippet sets it before paint).

### 4.3 How the cards / status badges work
Each hub card has an emoji icon, a title (Fraunces), a **status badge** (Ready = green, Finalizing = amber, Coming = grey, Live = green, Building = amber), a one-line description, and a hover-lift. The "Live App" card links to the Vercel URL; the "Build Progress" card links to the live board. The whole hub doubles as a "live taste of the app's look" — the premium styling + working light/dark toggle are real, so the owner judges the visual direction directly.

---

## 5. Design system

**Aesthetic direction: "fresh market receipt."** Warm paper by day, deep charcoal-green by night; an editorial serif wordmark paired with a clean grotesk body; monospace price numerals; receipt-perforation (dashed) dividers. Deliberately distinctive, appetite-adjacent, not generic AI.

### 5.1 Fonts (Google Fonts)
- **Display / headings / wordmark:** **Fraunces** (soft, characterful serif; opsz axis).
- **Body / UI:** **Hanken Grotesk**.
- **Prices / numerals / diagnostics:** **Spline Sans Mono** (tabular figures).

In the Next.js app these are loaded via `next/font/google` and exposed as CSS variables `--font-display`, `--font-body`, `--font-mono`. On the hub they're loaded via a Google Fonts `<link>`.

### 5.2 Colour tokens
**Light theme:**
```
--paper: #f4f1e8    --paper-2: #ece6d7   --card: #fffdf7   --card-2: #fbf7ee
--ink: #181a15      --ink-soft: #5b5e52  --ink-faint: #8b8d80
--line: #e4ddcc     --line-soft: #efe9db
--green: #1f9d57    --green-strong: #146b3c   --green-soft: #e3f3e7
--amber: #d9852a    --amber-soft: #f7ead0
--red: #cf4630      --red-soft: #f8e2dc
```
**Dark theme (`:root[data-theme="dark"]`):**
```
--paper: #0d120e    --paper-2: #0a0e0b    --card: #151b15   --card-2: #111710
--ink: #eaf0e4      --ink-soft: #9daa9b   --ink-faint: #6d7a6c
--line: #26302468   --line-soft: #1e271d
--green: #42d888    --green-strong: #82ecb0   --green-soft: #16301f
--amber: #f1b24e    --amber-soft: #2b2412
--red: #f0745b      --red-soft: #2e1a15
```
Background uses a subtle radial green glow + a faint SVG noise texture. Theme is stamped on `<html data-theme>` before paint (no flash), persisted to `localStorage`.

### 5.3 UX tokens (owner conventions)
- **Currency:** AED. Money stored internally as **whole fils** (1 AED = 100 fils) to avoid float drift; shown as `AED x.xx`.
- **Destructive actions always confirm first** (inline confirm, not a blocking modal).
- **Toasts:** bottom, auto-dismiss ~3s, non-blocking.
- **Store default:** Carrefour (owner shops there ~95% of the time; store is captured but not used for grouping).
- **Dates:** everything buckets by **Asia/Dubai** time and by the **pay-cycle month** (25th → 24th).

---

## 6. Architecture & tech stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript (strict).
- **Styling:** Tailwind CSS 3 + CSS-variable design tokens in `app/globals.css`.
- **Data layer:** **Server Actions** for all writes/reads — **there is NO separate API/REST layer** (the old app had 37 API routes; Shelfie has effectively none, just server actions + a couple of route handlers like `/version`).
- **ORM / DB:** Prisma **7** + **PostgreSQL on Neon** (region: AWS Europe Central 1, Frankfurt — closest to UAE). Prisma 7 specifics: the datasource URLs live in `prisma.config.ts` (not the schema), and the client uses the **`@prisma/adapter-pg` driver adapter** (`pg`).
- **Auth:** a single hashed **4-digit PIN** (Node `crypto.scrypt`) + a signed **`jose` JWT** session cookie (httpOnly, 7-day). Edge/Node split: `lib/session.ts` (jose, Edge-safe, used by middleware) vs `lib/auth.ts` (node:crypto, Node-only, used by server actions) — so `node:crypto` never enters the Edge middleware bundle.
- **PWA:** `public/manifest.webmanifest` + a **network-first** `public/sw.js` (so the installed app never serves a stale version) + real PNG icons; registered production-only.
- **Hosting:** **Vercel**, git-connected to the GitHub repo → **auto-deploys on every push to `main`**. Production alias: `shelfie-gamma-seven.vercel.app`.
- **Money:** integer fils everywhere; `lib/money.ts` is the only converter.
- **Testing:** Vitest (54 tests) covering the pure logic modules.

### 6.1 Why no client bundle of pdf.js (now)
Receipt reading moved server-side (see §15), so `pdfjs-dist` is no longer in any client bundle (verified by grepping `.next/static`). `next.config.mjs` marks `serverExternalPackages: ["pdfjs-dist"]` so it's used from `node_modules` in the serverless function rather than bundled.

---

## 7. Environment, config & the Windows toolchain

### 7.1 Environment variables (set in the Vercel dashboard — never committed)
- `DATABASE_URL` — the **pooled** Neon connection string (has `-pooler`), used at runtime.
- `DIRECT_URL` — the **direct/unpooled** Neon connection string, used for migrations.
- `SESSION_SECRET` — a random secret for signing PIN-session JWTs. **The app fails fast in production if this is unset** (a safety guard; a public dev fallback is only used in local dev).
- Auto-provided by Vercel at build: `VERCEL_GIT_COMMIT_SHA` → surfaced as `NEXT_PUBLIC_BUILD_ID` (short SHA) + `NEXT_PUBLIC_BUILT_AT` (build time) for the version stamp / update check.

**Privacy/handling note:** the assistant does NOT handle the DB password. The owner pastes the Neon strings + `SESSION_SECRET` into Vercel himself. Local development is DB-free.

### 7.2 Build scripts (`package.json`)
- `"postinstall": "prisma generate && node scripts/copy-pdf-assets.mjs"` — generates the Prisma client (offline) and copies pdf.js runtime assets (worker, cmaps, standard_fonts) into `public/pdfjs/` (a leftover from the on-device attempt; harmless now that reading is server-side).
- `"build": "next build"` — DB-free local build.
- `"vercel-build": "prisma migrate deploy && tsx prisma/seed.ts && next build"` — Vercel runs this: applies migrations to Neon, seeds categories, then builds.
- `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"dev": "next dev"`.
- `"gen:icons": "node scripts/gen-icons.mjs"` — renders PNG app icons from `public/icon.svg` via `sharp` (dev-only dependency).

### 7.3 The `#`-in-path saga (important environment lesson)
The project was originally at `C:\Users\games\Documents\xCloudy\IDEAS\FilsWise#2`. The `#` broke the JS toolchain because tools URL-parse paths and treat `#2` as a fragment: it crashed the webpack production build (null-byte in `@vercel/nft`) and **completely broke Vitest** (couldn't load any test file). Fix: the project was **relocated to `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie`** (a clean, `#`-free path) via `git clone`, preserving all history. Everything worked after that. The old `FilsWise#2` folder is a stale leftover; the live project is `IDEAS\Shelfie`. **Do all work in `IDEAS\Shelfie`** — note the shell's default working directory may still point at the old `FilsWise#2` path, so always `Set-Location -LiteralPath "...\IDEAS\Shelfie"`.

### 7.4 Windows toolchain specifics
- Git is available on PATH as `git` (v2.54); GitHub CLI `gh` is authenticated as `xCloudy75z` (scopes: repo, workflow, gist, read:org).
- Vercel CLI is installed and authenticated as `xcloudy75z`.
- Node v25, npm, Python 3.12, and `pdftotext` (from Git's poppler) are all available.
- Run npm/npx/vercel via `cmd /c "..."` from PowerShell.
- The shell resets its working directory between calls — always pass absolute paths.

---

## 8. Data model (`prisma/schema.prisma`)

Six models. All money is integer **fils**. Migrations: `prisma/migrations/0_init` (all 6 tables) + `1_add_last_backup_at` (adds `Settings.lastBackupAt`).

- **Category** — `id`, `name` (unique). Preset list seeded: Dairy, Produce, Bakery, Household, Snacks, Groceries.
- **Item** — `id`, `name` (unique), `normalized` (indexed; lowercased/punct-stripped for matching), `categoryId?`, `createdAt`. The "remembered item" spine: powers autocomplete + price history + category auto-fill.
- **Purchase** — `id`, `itemId`, `totalFils` (line total incl VAT / what was paid), `quantity` (Float, default 1), `unit` ("each" | "kg"), `store` (default "Carrefour"), `onOffer` (bool), `purchasedAt` (DateTime), `monthKey` (indexed; **pay-cycle** "YYYY-MM" in Dubai time), `importId?` (→ ReceiptImport), `createdAt`.
- **Budget** — `id`, `monthKey` (unique), `amountFils`.
- **ReceiptImport** — `id`, `fingerprint` (unique — dedupe key), `store`, `totalFils`, `importedAt`. One row per imported receipt; purchases link via `importId`.
- **Settings** — singleton (`id = 1`): `pinHash?`, `pinSalt?`, `failedAttempts`, `lockedUntil?`, `lastBackupAt?`.

Price history is computed **live** from Purchase rows (no cached stats table).

---

## 9. Features in detail

### 9.1 Log tab (`app/(app)/log/page.tsx`)
- **Import Carrefour receipt (PDF)** button at the top (the flagship "fast logging" — see §15 for its current state) + `<ReceiptImport>` component.
- **Manual entry** (`PurchaseForm.tsx`): Item (custom React typeahead — filters remembered items, tap to fill, still allows new names; replaced the flaky `<datalist>` which doesn't work on iOS Safari), Price (AED, validated — blank/zero/negative rejected), Qty (default 1), Store (select, default Carrefour), Category (select, auto via `guessCategory`), optional "was on offer" toggle. Save → toast → form clears.
- **Item-identity confirm:** on save, `resolveItem` runs. Exact normalized match → reuse. If the new name **shares a base word** with an existing item (owner's chosen behaviour — e.g. "Milk 2L" vs "Milk"), it prompts *"Is this the same as X?"* [Yes, same] / [No, new]. Unrelated names save straight through. Prevents duplicate/fragmented items.

### 9.2 Prices tab (`app/(app)/prices/page.tsx`)
- Item picker (`PriceItemPicker.tsx`) — selecting an item **instantly** loads its story (client `router.push('?item=...')`, no extra click).
- `PriceCard.tsx` — Last paid / Best ever / Average / Highest, with store + Dubai-formatted dates; shows "not enough recent prices to judge yet" when fewer than 3 recent non-offer buys.
- `ShelfCheck.tsx` — type the shelf price → verdict pill: **Great / Cheaper / About the same / Pricier** (or "unknown"). The "Check" button is only for this verdict.
- **Verdict correctness (from the review):** all comparisons use **unit price = total ÷ quantity** (a 6-pack line never distorts a single); the benchmark **excludes on-offer purchases** and uses a **rolling 12-month window anchored to *now*** (passed in), so a one-off promo or a 2-year-old price can't poison it; the verdict is **suppressed below 3 samples**; only same-unit-basis purchases (per-kg vs per-each) are compared.

### 9.3 Month tab (`app/(app)/month/page.tsx`)
- **Pay-cycle month** header (e.g. "July 2026 · 25 Jun – 24 Jul") — a month runs the **25th of the previous calendar month → the 24th**, in Asia/Dubai. Prev/next nav.
- Spend vs budget with a green/amber/red **pace bar** + a projection using the real cycle length; **Set/change budget** (defaults a new month to the previous month's amount; handles no-budget gracefully — no divide-by-zero).
- **Category breakdown** bars (`CategoryBars.tsx`), joining Purchase→Item→Category.
- **Editable purchase list** (`EditablePurchases.tsx`) — tap a purchase to edit price/qty/store/date; **Delete** with an inline confirm (deleting an item's last purchase also removes the now-orphan item).
- **"Your data" card** (`BackupRestore.tsx`) — Back up now (downloads `shelfie-backup-<date>.json`, records "Last backed up"), Restore from file, and a "🛟 Not backed up yet" nudge until first backup.
- **"App version" card** (`VersionBar.tsx`) — build date + short SHA + an **Update** button that fetches `/version`, compares the deployed vs running build id, and reloads if newer.

### 9.4 Backup & Restore (`lib/backup.ts`, `app/actions/backup.ts`)
Modelled on the owner's "Car Service History" app. **Hard-verified safety** (11 unit tests):
- Backup format carries **no database ids** (`{app:"shelfie", schemaVersion, exportedAt, items, purchases, budgets}`) → restore always mints fresh ids (a file's ids are never trusted).
- `validateBackup` rejects: a **foreign file** ("This isn't a Shelfie backup"), a **newer schema version** ("update the app first"), a **corrupt/malformed file**, and **neutralises booby-traps by whitelisting** (rebuilds the object field-by-field with coerced types; drops injected `__proto__`/`id`/script keys).
- `restoreBackup` = **REPLACE** semantics: it **snapshots current data first** (so a wrong file can never wipe history), runs the wipe+rebuild in a `$transaction`, and returns the snapshot so **Undo** just replays it. Server re-validates (defence in depth).

### 9.5 Auth / PIN (`lib/auth.ts`, `lib/session.ts`, `app/actions/auth.ts`, `app/lock/`)
- First run: set a 4-digit PIN (scrypt hash + per-PIN salt stored in Settings). Thereafter: enter it. Throttle: lockout for 60s after 5 failed attempts (server-side, DB-backed). Success → httpOnly `shelfie_session` JWT (7-day). `middleware.ts` redirects any unauthenticated request to `/lock`; `/` redirects to `/log`.

### 9.6 PWA / install
- Manifest (standalone, green theme), network-first service worker (`skipWaiting`/`clients.claim`, so installs auto-update), and PNG icons (`apple-touch-icon.png` 180, `icon-192/512.png`, `icon-maskable-512.png`) generated from `public/icon.svg` (a white cart on green) via `scripts/gen-icons.mjs`.

---

## 10. Locked design decisions

Treat these as immutable (change only with owner approval):
- **Pay-cycle month = 25th of previous month → 24th** (Asia/Dubai). "July" = 25 Jun → 24 Jul. Same as the owner's FinanceOS app.
- **Categories only** for grouping (no store-based grouping — owner is ~95% Carrefour). Category **auto-fills** from the remembered item (set once per new item).
- **Store defaults to Carrefour**, captured on each purchase, not used for reports.
- **Item matching prompts on a shared base word** (size/pack variants like "Milk 2L" vs "Milk" pause and ask same-or-new).
- **Price verdicts use unit price**, exclude offers from the benchmark, use a rolling 12-month window, and are suppressed below 3 samples.
- **Money = integer fils**; **dates = Asia/Dubai**.
- **Standalone single-user app** (no portal SSO, no multi-user). One 4-digit PIN.
- **Restore = replace-all with snapshot + undo.**
- **Receipt parsing intent:** free deterministic parser (no AI, no per-scan cost). *(Where it runs — device vs server — is the current open question, see §15.)*
- **Build = 3 sequential plans:** Plan 1 (core), Plan 2 (receipt import), Plan 3 (polish: item-merge tool, offline, etc. — not started).

---

## 11. The adversarial review (18 findings)

Before writing core code, an Opus "skeptical engineer" tried to break the design. It found real correctness holes; **17 of 18 were folded into the build.** Full text: `/review.html`. The load-bearing ones:
- **Critical:** compare unit price not line totals; keep item identity clean (fuzzy match + merge); never double-import a receipt (fingerprint dedupe); parser must never auto-commit a mismatched parse (review-before-save).
- **Major:** exclude offer prices from the "best ever" benchmark; suppress the verdict below a min sample; category on imported items; weighed-item unit basis; **PIN brute-force throttle**; **data export/backup** (no single point of loss); honest offline claim; **Dubai-time month bucketing**.
- **Minor:** cross-store note, no-budget guard, recurring budget default, typo junk items, stale-price windowing, session lifetime.
- A later lib-foundation review found two more (I-1/I-2): the "enough to judge" gate must reflect the *windowed* benchmark set, and the window must anchor to *now* not the latest purchase — both fixed with regression tests. A final review confirmed no `pinHash` leak in export and flagged price-validation + session-secret fail-fast (fixed).

---

## 12. File-by-file reference

**`lib/` (pure logic, unit-tested):**
- `money.ts` — `filsFromAed`, `aedFromFils`, `formatAed`, `parsePriceFils` (rejects blank/≤0).
- `dates.ts` — `dubaiMonthKey` (pay-cycle 25→24), `dubaiToday`, `monthKeyToLabel`, `cycleRange`.
- `price-stats.ts` — `computeStats(purchases, unit, now)` + `shelfVerdict` (the correctness core).
- `items.ts` — `normalizeName`, `resolveItem` (exact / suggest-on-shared-base-word / new; Levenshtein + significant-token overlap).
- `categories.ts` — `PRESET_CATEGORIES`, `guessCategory` (keyword→category).
- `receipt.ts` — `parseReceipt(lines)` → items/totals/self-check + `computeFingerprint` (FNV-1a, order-independent).
- `backup.ts` — `validateBackup`, `CURRENT_BACKUP_VERSION`, types.
- `auth.ts` — `hashPin`/`verifyPin` (node scrypt). `session.ts` — `makeSession`/`readSession` (jose, Edge-safe, fail-fast on missing secret).
- `db.ts` — Prisma 7 client singleton (pg adapter).
- `receipt-extract.ts` — **browser** pdf.js extraction (kept but no longer imported — the on-device path that fails on iOS).
- `receipt-extract-server.ts` — **Node/server** pdf.js extraction (the current path; see §15).

**`app/actions/` (server actions):** `auth.ts` (setPin/verifyPin/lock), `purchases.ts` (addPurchase/updatePurchase/deletePurchase), `budget.ts` (setBudget), `backup.ts` (buildBackup/markBackedUp/restoreBackup), `receipt.ts` (importReceipt + `parseReceiptUpload`).

**`app/(app)/`** — the authed shell + `log`/`prices`/`month` pages. **`app/components/`** — the UI pieces (TabBar, ThemeToggle, PurchaseForm, PriceCard/PriceItemPicker/ShelfCheck, CategoryBars/EditablePurchases, BackupRestore, VersionBar, ServiceWorkerRegister, ReceiptImport). **`app/lock/`** — PIN screen + PinPad. **`app/version/route.ts`** — build-id endpoint. **`middleware.ts`** — auth guard.

**`prisma/`** — schema, config, migrations, seed. **`scripts/`** — `copy-pdf-assets.mjs`, `gen-icons.mjs`. **`tests/`** — money, dates, price-stats, items, auth, receipt, backup (54 tests). **`docs/`** — the hub. **`plans/`** — the two implementation plans.

---

## 13. Build history (every task & commit)

**Design phase:** `412b185` mockup+spec → `8697440` premium hub + adversarial review → `cd02edb` Plan 1 written.

**Plan 1 — Core (16 tasks, all shipped & live):**
`4e2decb` scaffold (Next 15 + Tailwind + Vitest) · `c4a19e8` money · `3211639` Dubai dates · `0cd3c9b` price-stats · `3be0da4` item resolution · `23af338` fix @ alias + clean-path move · `6451526` price-stats window fix (review I-1/I-2) · `a4223c6` Prisma schema (6 tables) + offline migration + seed · `5a6a548` PIN auth (edge-safe split) · `db9bc9c` app shell + tab bar · `6cf5c7a` `/`→`/log` + Plan for version stamp · `fbb11be` Log tab · `4a26b5e` Prices + Month tabs · `4883225` matcher: shared-base-word prompt · `72ff3c6` data export + version stamp + one-tap update + PWA · `f58be0b` edit/delete purchases · `6ef9fc1` safety fixes (price validation, session fail-fast, /log revalidate) · `d7c9e73` Backup & Restore + version card · `d8294bb` real PNG app icons · `e84b276` mobile autocomplete + instant prices · `4fa4835` remove dead export code.

**Plan 2 — Receipt import:**
`f15a42c` Plan 2 + pdfjs dep · `a9fdc84` pure parser (coordinate-line based) · `1ce5e64` on-device pdf.js extraction · `61b93e2` importReceipt + fingerprint dedupe · `a26131a` receipt import UI (draft review + dedupe confirm) · `51b5870` pay-cycle month bucketing · then the debugging saga (§15): `f182fef` cmaps/fonts+timeout · `6cfccf4` diagnostics · `03ca1ac` main-thread fix · `4df0f1e` instrumentation · `09842ea` legacy build · `1c07365` server-side extraction (current).

Interspersed `progress:` commits update the live board.

---

## 14. How to run, deploy & verify

```powershell
Set-Location -LiteralPath "C:\Users\games\Documents\xCloudy\IDEAS\Shelfie"
cmd /c "npm install"          # runs postinstall (prisma generate + copy pdf assets)
cmd /c "npm test"             # 54 tests
cmd /c "npm run typecheck"    # clean
cmd /c "npm run build"        # DB-free local build
```
- **Deploy:** just `git push origin main` — Vercel auto-builds (`vercel-build` runs migrate deploy + seed + build) and aliases to `shelfie-gamma-seven.vercel.app`. Verify with `vercel ls shelfie` / `vercel inspect <url>` (look for `status ● Ready`), then hit the live URL.
- **DB:** Neon project `shelfie` (Frankfurt). Env vars `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `SESSION_SECRET` set in the Vercel dashboard.
- **Git:** `git` on PATH; `gh` authed as `xCloudy75z`; commit co-author line `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## 15. The receipt-import debugging saga (the open problem)

**Goal:** upload the Carrefour "Tax Invoice" PDF → parse each line (item, qty, unit price, line total) → review → save the trip. **The parser is proven correct.** The failure is entirely in *getting the PDF's text out* in the owner's environment (iPhone, iOS 18.1.1 Safari, installed as a PWA).

### 15.1 What's proven to work
Running the exact extraction in **Node** (pdf.js `legacy` build, main thread, `useSystemFonts:true`) against the owner's real receipt produced a **perfect parse: 28 items, correct quantities/units (incl. weighed kg items), correct prices, and the summed total matched the receipt's grand total (AED 328.48) exactly.** The receipt layout (confirmed via a privacy-safe coordinate read): each item is one visual row `<Description> <Qty> <UnitPriceInclVAT> <…> <TotPriceInclVAT>` followed by a `Barcode:` line; weighed items have a fractional qty; the receipt also contains **Arabic text** in headers.

### 15.2 The 7 attempts (all failed on the owner's iPhone)
1. **Original — client pdf.js, worker via `new URL(...import.meta.url)`** (`1ce5e64`). → **Hung** on "Finding items & prices" for 1min+.
2. **Ship pdf.js cmaps + standard fonts + move worker to `/public` + add a 45s timeout** (`f182fef`), hypothesising the Arabic (CID) fonts stalled `getTextContent` without CMaps. → Still failed ("Couldn't read that file").
3. **Add a diagnostics panel** (`6cfccf4`) to capture the real cause. → Revealed **`TIMEOUT`** (the 45s fired — a hang), on **iOS 18.1.1**, serviceWorker present.
4. **Run pdf.js on the MAIN THREAD** (`03ca1ac`) by pre-registering `globalThis.pdfjsWorker = { WorkerMessageHandler }` — root cause verified *from the pdf.js source*: in the browser pdf.js spawns a module Web Worker and waits for its "ready" message; on iOS Safari the worker spawns but **never signals ready**, and pdf.js only falls back to the main thread when the worker *errors*, not when it *hangs*. → Still `TIMEOUT`.
5. **Richer instrumentation** (`4df0f1e`): build stamp, a "is the main-thread handler loaded" flag, and the exact stall stage. Diagnostics then showed: `build: <latest>` (not stale), `pdfHandler: function` (main-thread fix IS active), and **`TIMEOUT: stalled at [opening document]`** — i.e. `getDocument().promise` never resolves, even on the main thread, at open time.
6. **Switch the browser to the pdf.js `legacy` build** (`09842ea`) — the only remaining difference from the proven Node config. → The behaviour **changed** from a hang to a fast throw: **`undefined is not a function (near '...t of e...')`** — a `for…of` over something undefined, deep in Apple's/pdf.js's minified engine during document-open. (Verified the worker's `.setup` export exists in all builds, so it isn't a missing-export bug.)
7. **Move extraction to the SERVER** (`1c07365`) — the owner approved this after the on-device path proved to be an un-reproducible iOS-Safari wall. The PDF uploads to a Node Server Action (`parseReceiptUpload`), pdf.js reads it in Node (where it's proven), the PDF is discarded, only items/prices returned. **This is ALSO currently failing** on Vercel: the UI shows *"Couldn't read that PDF — is it the Carrefour receipt?"* (the `{error}` branch of `parseReceiptUpload` — the server extraction threw).

### 15.3 Where it stands / the immediate next step
The server-side (Node) extraction is proven locally but **throwing on Vercel's serverless runtime**. The exact server error has **not yet been captured** — the immediate next diagnostic is to read the **Vercel function logs** for the `parseReceiptUpload` action:
```
vercel link --yes --project shelfie
vercel logs <deployment-url>     # then trigger an import to see the runtime error
```
**Leading hypothesis for the server failure:** `useSystemFonts:true` needs fontconfig/system fonts that the Vercel serverless (Amazon Linux) image may lack, causing pdf.js to throw during open — OR a subtle bundling/runtime issue with `pdfjs-dist` in the serverless function despite `serverExternalPackages`. **Likely fix:** drop `useSystemFonts` and/or point `cMapUrl`/`standardFontDataUrl` at on-disk pdf.js assets available in the function (they're in `node_modules/pdfjs-dist/` and `public/pdfjs/`), or feed pdf.js a plain `Uint8Array` with disabled font/eval features. Because it's **Node**, the error is fully visible in logs — unlike the iOS black box — so this is tractable.

### 15.4 Key takeaways for whoever continues
- **The parser and the receipt format are solved.** Don't touch `lib/receipt.ts` / `lib/receipt-extract-server.ts`'s row-reconstruction — they're correct.
- The problem is purely **pdf.js text extraction in the target runtime.** On-device (iOS Safari) is a WebKit dead-end (parked). Server-side (Node) is the chosen path and *works locally*; it just needs the **Vercel serverless environment** sorted (read the logs, adjust the font/cmap config).
- Privacy constraint still applies: the server reads the PDF in memory and **stores nothing** but item names + prices.

### 15.5 RESOLVED (2026-07-12) — server extraction works on Vercel
The exact Vercel failures were captured from the live function logs (the old `catch` swallowed them; a one-line `console.error` surfaced them). Two runtime-specific crashes — each reproduced locally by **hiding `@napi-rs/canvas` to simulate Vercel's Linux image**, then fixed:
1. **`ReferenceError: DOMMatrix is not defined`** at pdf.js module load. pdf.js v6's Node build gets `DOMMatrix`/`Path2D` from the optional native `@napi-rs/canvas`, which isn't reliably present in Vercel's serverless function. **Fix:** install tiny pure-JS `DOMMatrix`/`Path2D` shims *before* importing pdf.js (receipt text extraction never uses the matrix math). Commit `2228103`.
2. **`Setting up fake worker failed: Cannot find module …/pdf.worker.mjs`.** In Node, pdf.js loads its worker via an import marked `webpackIgnore`/`@vite-ignore`, so the bundler skips the file and it's absent on Vercel. **Fix:** import the worker with a plain literal specifier (so it's traced into the bundle) and set `globalThis.pdfjsWorker` so pdf.js uses it directly. Commit `c93c10c`.
**Verified live:** a real Carrefour receipt on the owner's iPhone → 30 items → green "Total matches ✓"; the import/dedupe/review flow works. The next evolution is **Receipt Import v2** (barcode identity + offers) — see `docs/superpowers/specs/2026-07-12-receipt-import-v2-design.md`.

---

## 16. Known issues & recommended next steps

1. **Receipt import — DONE (2026-07-12):** `parseReceiptUpload` works on Vercel (see §15.5). The next step is **Receipt Import v2** — barcode-based item identity, per-item offers, and an accuracy self-check — designed and awaiting approval (`docs/superpowers/specs/2026-07-12-receipt-import-v2-design.md`).
2. **On-device receipt reading (parked):** revisit later as a privacy upgrade only if a reliable iOS-Safari pdf.js path is found (or a different in-browser PDF text approach). `lib/receipt-extract.ts` + `public/pdfjs/` assets are retained for that.
3. **Plan 3 (polish, not started):** item-merge tool (fold accidental duplicate items together), offline stats cache, deeper PWA.
4. **Cosmetic:** receipt item names come from Carrefour as short codes (e.g. "AL MARAI MILK FF 1"); a rename/alias nicety could help (the review screen already lets the user edit names before saving).
5. **`.vercel`** folder is created locally by `vercel link` — ensure it stays gitignored.

---

*End of master documentation. Everything above reflects the project as built through commit `1c07365`. The single unfinished piece is server-side PDF text extraction on Vercel (§15); the app is otherwise complete and live.*
