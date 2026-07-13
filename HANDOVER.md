# 🤝 Shelfie — Session Handover (read this first)

**Purpose:** This is a cold-start handover. If you are a fresh session with no prior context, **read this document top to bottom — it contains everything you need: the rules, the way we work, the current state, and the exact next step.** Do not rely on external memory for rules or workflow; they are all here. For exhaustive detail, read `docs/MASTER-DOCUMENTATION.md` (the full reference).

---

## 0. 30-second orientation
- **Project:** Shelfie — a deliberately simple, single-user UAE grocery **price + budget tracker** (a much-simpler rebuild of an over-built app called FilsWise). 3 tabs, one 4-digit PIN, ~6 DB tables.
- **Live app:** https://shelfie-gamma-seven.vercel.app · **Hub:** https://xcloudy75z.github.io/shelfie/ · **Repo:** https://github.com/xCloudy75z/shelfie
- **Local working dir:** `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie` (NOT the stale `IDEAS\FilsWise#2`).
- **State:** The whole app is **built, live, and working** — including **receipt PDF import + Receipt Import v2** (barcode identity two-way, per-item offers, auto-detected trip date, per-unit prices, multi-buy, dedupe, plus a "Start fresh" reset) — all **verified live on 2026-07-12**. No open blockers. Remaining work is optional polish (see §5): *show the barcode*, *merge tool*, *camera scanning* (+ the owner's "scan → price story" idea).

---

## 1. THE RULES (self-contained — follow these; they are not optional)

### 1.1 Model
- **ALL OPUS, NO SONNET.** Every step and every spawned subagent/workflow runs on Opus. Pass the Opus model explicitly when dispatching subagents.

### 1.2 The owner is remote — he can only see live web pages
- The owner ("A", UAE, non-technical founder) is on a **remote session**; he **cannot see local files, the preview pane, or MCP widgets — only real web pages.**
- **Nothing is "approved" until he has seen it in a browser with his own eyes.** He loves HTML pages with clickable buttons.
- So: **publish anything for him to review as HTML on GitHub Pages** (the `/docs` folder → the hub) and give him the URL. Never rely on local files / preview / pasted specs.
- **In-chat multiple-choice questions DO work for him** — use them for decisions.

### 1.3 Privacy is top-critical (absolute — "severe consequences" if broken)
- **Never read, recognise, or save the owner's personal data** (name, card/loyalty numbers, email, phone, address, receipt/transaction IDs, cashier). If you cross any, **delete it immediately** and never write it to memory.
- **Do NOT open a file that may contain personal data (e.g. a receipt PDF) raw.** Extract only the non-personal structure via a script that redacts BEFORE you see it: `pdftotext -layout` → keep only product/price/structural lines → mask any digit-run ≥7 → drop email/personal-keyword lines → delete the raw immediately. Product names + prices are NOT personal; his identity is.
- The repo holds only code + mockups — **never real receipts, spending data, DBs, or secrets** (`.gitignore` hard-blocks them). Do NOT handle the DB password; the owner sets `DATABASE_URL`/`DIRECT_URL`/`SESSION_SECRET` in Vercel himself.

### 1.4 How we build (the "superpowers" workflow)
For any feature: **brainstorm → write spec → write a bite-sized TDD plan (`plans/*.md`) → subagent-driven development (a fresh Opus subagent per task, strict TDD: failing test → run → implement → pass → commit) → verify the real thing runs.** No code before an approved design.

**Adversarial "try to break it" at ALL THREE stages — mandatory, this is what produces the golden version:**
1. **Break the SPEC** — before planning, a fresh skeptical Opus review attacks the *design* for correctness holes, edge cases, data-integrity and privacy risks. Fold findings in before writing the plan.
2. **Break the PLAN** — before any code, a fresh skeptical Opus review attacks the *plan* itself: wrong/invalid test fixtures, bad task ordering, framework gotchas (e.g. `"use server"` export rules), missed spec coverage. Fold findings in before building.
3. **Break the BUILD** — after coding, a fresh skeptical Opus review attacks the *implementation* against the spec's adversarial cases, THEN verify live on the real runtime (Vercel + the owner's phone). Fix anything found (failing test → fix → commit).

Lesson (2026-07-12): a bug can survive spec + plan review and only die at build-review or live test (the over-strict barcode validator). So **all three passes AND a real live run are required** — none is optional. Use the superpowers skills (brainstorming, writing-plans, subagent-driven-development, test-driven-development, verification-before-completion, systematic-debugging, requesting-code-review).

### 1.5 Systematic debugging (used heavily — see the receipt saga)
**No fixes without root-cause investigation first.** Read the actual error, reproduce, instrument boundaries, form ONE hypothesis, test the smallest change, verify. If 3+ fixes fail, **question the architecture** (this is exactly what led to moving receipt reading server-side).

### 1.6 Build cadence
Never build everything in one run. Build the core happy-path, **package it live early, verify the real artifact runs, then stop and check in** before adding more.

### 1.7 Communication
Plain English first, the *why* before the *what*, short scannable messages, honest about failures (show evidence), a live progress board that flips tasks green. Commit + push frequently (every push auto-deploys to Vercel). Commit co-author line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### 1.8 Keep the hub + docs LIVE (owner preference)
Update the hub progress board (`docs/progress.html`) and the docs **continuously as work happens** — not as a separate "finalize" phase. The owner watches the board (auto-refreshes every 60s) and reviews only via the hub. Push after each meaningful step so it reflects reality in real time.

### 1.9 Destructive actions confirm first
Destructive DB operations (wipe / reset / drop) **always confirm first**, and are built confirmation-gated in the UI (the app has a "Start fresh" reset that keeps the PIN). Deleting files: show the full list → get explicit approval → confirm done.

### 1.10 Devices & testing (owner setup — locked 2026-07-13)
The owner works across **4 devices**: **① Local PC** (dev machine — git/build/deploy), **② iPhone = "Remote 1"** (his own phone; the **actual keeper / device of record**; currently at home — phones barred in college), **③ College PC = "Remote 2"**, **④ College phone (Android) = "Remote 3"** (loaner — **all live testing happens here now**).
- **Live-verify on the Android (Remote 3)** by default — "check it on your phone" = Android/Chrome (install via Chrome ⋮ → "Add to Home screen").
- **Trigger phrase "iPhone Update":** when the owner says it, share ALL steps to do on the **iPhone (Remote 1)** — iOS Safari install/update (Share → Add to Home Screen), tap **Update** on Month → App version, verify. That's when the iPhone syncs to the latest app.
- **Never suggest exporting a backup from the Android** — the owner won't (data is server-side, so a device switch needs no backup).
- **Key nuance:** Shelfie is single-user + server-backed (one Neon DB, one PIN) → **all devices share the SAME data**. Android testing writes to the data the iPhone keeps; there is no isolation, so avoid the "Start fresh" reset / bulk deletes on the Android unless a real wipe is intended.

---

## 2. Tech stack & architecture (what you're working in)
- **Next.js 15** (App Router), React 19, **TypeScript (strict)**, **Tailwind 3** + CSS-variable tokens in `app/globals.css`.
- **Server Actions for everything — NO REST/API layer.**
- **Prisma 7 + Postgres on Neon (Frankfurt).** Prisma 7 specifics: URLs live in `prisma.config.ts`; runtime uses the `@prisma/adapter-pg` driver adapter. 6 tables: Category, Item, Purchase, Budget, ReceiptImport, Settings (all money = integer **fils**; dates = **Asia/Dubai**; months = **pay-cycle 25th→24th**).
- **Auth:** hashed 4-digit PIN (`node:crypto` scrypt) + `jose` JWT session cookie. Edge/Node split: `lib/session.ts` (jose, middleware) vs `lib/auth.ts` (node crypto, actions).
- **Hosting:** Vercel, git-connected → **auto-deploys on every push to `main`.** `vercel-build` = `prisma migrate deploy && tsx prisma/seed.ts && next build`.
- **PWA:** manifest + network-first service worker + PNG icons. **Design system:** "fresh market receipt" — Fraunces (display) + Hanken Grotesk (body) + Spline Sans Mono (prices); warm-paper light / charcoal-green dark; full token values in the master doc §5.

---

## 3. What's DONE and live (don't redo)
Plan 1 (core, 16 tasks) + several extras, all shipped: PIN lock + throttle; **Log** (manual entry + mobile typeahead + item-identity confirm); **Prices** (unit-price verdict, offer-excluded, 3-sample gate, instant load); **Month** (pay-cycle budget/pace, category bars, edit/delete purchases); **Backup & Restore** (validated, snapshot+undo); **auto-update + version stamp**; **installable PWA + icons**. **54 unit tests green**, 3 review passes. The receipt **parser** (`lib/receipt.ts`) is also done and **proven correct**. **Receipt import + Receipt Import v2 are now fully shipped & verified live (2026-07-12)**: server-side PDF read on Vercel, barcode identity (two-way, **lenient** validation — real Carrefour codes fail the GTIN check digit), per-item offers, no-barcode flag, "same as"/detach linking, dual dedupe, multi-buy, auto-detected trip date (anchored to the "Invoice Date" line), per-unit prices, a scrollable Month purchases box, and a confirmation-gated **"Start fresh"** reset. **103 unit tests green.**

---

## 4. Repo map (where things are)
- `docs/MASTER-DOCUMENTATION.md` — **the full reference** (read for depth).
- `docs/` — the GitHub Pages hub: `index.html` (hub), `mockup.html`, `spec.html`, `review.html`, `progress.html` (live board, auto-refresh 60s), `masterdoc.html`, `shelfie.css`, `theme.js`.
- `plans/2026-07-10-shelfie-core.md` (Plan 1) · `plans/2026-07-11-shelfie-receipt-import.md` (Plan 2).
- `lib/` pure logic (money, dates, price-stats, items, categories, receipt, **barcode** (GTIN-14 canonicalise, lenient), **receipt-match** (`resolveDraftIdentity`), **purchase-match** (`resolveManualIdentity`, `shouldDeleteOrphan`), backup, auth, session, db) + `receipt-extract.ts` (browser, parked) + `receipt-extract-server.ts` (server, current). **Pure resolvers live in `lib/` — a `"use server"` file may only export async functions.**
- `app/actions/` server actions · `app/(app)/{log,prices,month}` tabs · `app/components/` UI · `app/lock/` PIN · `middleware.ts`.
- `prisma/` schema+config+migrations+seed · `tests/` (54) · `scripts/` (copy-pdf-assets, gen-icons).

---

## 5. Receipt import — ✅ DONE, and Receipt Import v2 SHIPPED (2026-07-12)

**Status:** Receipt import works end-to-end on Vercel, and **Receipt Import v2 is built, tested (103 unit tests), reviewed (design + plan + build adversarial passes), and verified live** on the owner's iPhone. Shipped: barcode-based item identity (two-way — receipt capture + optional manual barcode; **lenient** validation since real Carrefour codes fail the GTIN check digit, e.g. `071727355039`), per-item on-offer toggle, no-barcode "check this" flag, "same as"/detach linking, dual (barcode+legacy) dedupe, multi-buy, auto-detected trip date (anchored to the "Invoice Date" line, `DD-Mon-YYYY`), per-unit prices in Prices, a scrollable Month purchases box (~4 rows), and a confirmation-gated **"Start fresh"** wipe. Spec: `docs/superpowers/specs/2026-07-12-receipt-import-v2-design.md`; plan: `plans/2026-07-12-shelfie-receipt-import-v2.md`; live roadmap: the hub progress board.

**Remaining (optional polish, owner-prioritised):** *Show the captured barcode* on Prices/review (makes manual linking easy to verify), the *merge tool* (fold already-split duplicates), and *camera scanning* (needs an on-device iOS test first) — plus the owner's idea: **scan in-store → open that item's price story**.

**Categories & discount accuracy (Phase A) — BUILT 2026-07-12, awaiting break-build + live verify.** The Month "Spent"/budget now reflects what was actually PAID: each receipt stores a per-trip `discountFils` (shelf grand total − paid) and the Month derives the netted total from LIVE `Purchase.importId` (so deleting/restoring an imported item can never leave a phantom discount); items stay at shelf price and the category chart stays shelf-based. Unknown items now file as **Uncategorized** (null `categoryId`), not "Groceries" — `guessCategory` returns `string | null`. The owner can add/rename/delete categories (Month → Categories card, `CategoryManager`) with reserved-name + case-insensitive-dupe guards, and re-file any item on Prices (`ItemCategoryPicker`); deleting a category moves its items to Uncategorized. Backup restore wipes stale `ReceiptImport` rows. 119 unit tests green, typecheck + build clean. Spec: `docs/superpowers/specs/2026-07-12-categories-and-discounts-design.md`; plan: `plans/2026-07-12-shelfie-categories-and-discounts.md`. Migration `3_receipt_discount` applies on Vercel at deploy.

<details><summary>Original blocker (now resolved) — kept for history</summary>

### The original open task — fix receipt import (server-side extraction on Vercel)

**Context:** Reading the Carrefour PDF *on the phone* (iOS Safari) is a dead-end — it failed 7 different ways (hang → cmaps → main-thread → legacy build → `undefined is not a function`); root cause verified from pdf.js source (the browser worker never signals "ready" on iOS, and pdf.js won't fall back to main-thread on a *hang*). The owner **approved moving extraction to the server.** The server path (`parseReceiptUpload` in `app/actions/receipt.ts` → `lib/receipt-extract-server.ts`, pdf.js `legacy` build, main thread, `useSystemFonts:true`) is **PROVEN in local Node** (perfect 28-item parse) but is **currently throwing on Vercel's serverless runtime** — the app shows *"Couldn't read that PDF — is it the Carrefour receipt?"* (the `{error}` branch).

**Immediate next steps (systematic):**
1. **Get the real error** — read the Vercel function logs for the failing action:
   ```
   cd "C:\Users\games\Documents\xCloudy\IDEAS\Shelfie"
   cmd /c "vercel link --yes --project shelfie"
   cmd /c "vercel logs <latest-deployment-url>"   # then trigger an import on the live app to see the runtime throw
   ```
   (Vercel CLI is authed as `xcloudy75z`. `.vercel/` is gitignored.)
2. **Leading hypothesis:** `useSystemFonts:true` needs fontconfig/system fonts absent on Vercel's Amazon-Linux serverless image, so pdf.js throws at open — OR a `pdfjs-dist` serverless bundling/runtime quirk despite `serverExternalPackages:["pdfjs-dist"]` in `next.config.mjs`.
3. **Likely fix:** drop `useSystemFonts`; instead point pdf.js at on-disk assets available in the function — `standardFontDataUrl`/`cMapUrl` can be filesystem paths to `node_modules/pdfjs-dist/standard_fonts/` and `.../cmaps/` (or the copied `public/pdfjs/...`) read via Node, or pass a plain `Uint8Array` with font/eval features disabled. Because it's **Node**, the error is fully visible in logs (unlike the iOS black box) — so this is tractable. **Do NOT change `lib/receipt.ts` or the row-reconstruction logic — they are correct.**
4. **Verify end-to-end on the live URL** with a real receipt (owner tests on his phone): upload → server parses → review list of ~28 items with a green "Total matches ✓" badge → save → items appear in Month/Prices. Re-import the same file → duplicate warning. A non-receipt PDF → friendly error.

</details>

---

## 6. First actions for a new session
1. Read this file, then skim `docs/MASTER-DOCUMENTATION.md`.
2. Confirm you're working in `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie` (always `Set-Location -LiteralPath` there; the shell may default to the stale `FilsWise#2`).
3. Sanity check: `cmd /c "npm install"` → `cmd /c "npm test"` (expect **103 pass**) → `cmd /c "npm run build"` (clean).
4. Receipt import + Receipt Import v2 are DONE (§5). Any next work is the optional polish listed in §5 (show barcode · merge tool · scanning) — follow the full workflow (§1.4): brainstorm → spec → plan → subagent TDD → verify live.
5. Keep the owner in the loop his way (§1.2): publish anything reviewable to the hub, use in-chat questions for decisions, and push often (auto-deploys). Update `docs/progress.html` as you go.

---

## 7. Environment gotchas
- **The `#` path is why the project lives at `IDEAS\Shelfie`** (a `#` in the old path broke Vitest + the webpack build). Never move it back.
- Run npm/npx/vercel via `cmd /c "..."`. Git is on PATH; `gh` authed as `xCloudy75z`; Vercel authed as `xcloudy75z`.
- No local DB — local build/tests are DB-free; DB work happens on Vercel (migrate deploy in `vercel-build`).
- After any push, verify the deploy: `cmd /c "vercel inspect <url>"` → `status ● Ready`, then hit the live URL.

---

## 8. Issues we hit & the exact fix (DON'T re-debug these — 2026-07-12)

A troubleshooting playbook so a new session doesn't spend 100 iterations rediscovering these. All are already fixed in the code; this is *why* and *what*, in case they recur or you touch nearby code.

**pdf.js won't run in Vercel's serverless function** (two separate crashes, both fixed in `lib/receipt-extract-server.ts`):
1. `ReferenceError: DOMMatrix is not defined` at module load — pdf.js v6 gets `DOMMatrix`/`Path2D` from the optional native `@napi-rs/canvas`, which isn't in the Vercel bundle. **Fix:** install tiny pure-JS `DOMMatrix`/`Path2D` shims on `globalThis` **before** dynamically importing pdf.js (text extraction never uses them). Do NOT try to make `@napi-rs/canvas` bundle — that path failed.
2. `Setting up fake worker failed: Cannot find module …/pdf.worker.mjs` — pdf.js loads its worker via an import marked `webpackIgnore`, so the bundler skips it. **Fix:** `import()` the worker with a plain literal specifier (so it IS bundled) and set `globalThis.pdfjsWorker` so pdf.js uses it directly.

**Server Action save failed silently ("Couldn't save").** Root cause: **Prisma interactive `$transaction` default timeout is 5s**; a ~30-item receipt (~90 sequential writes to Neon Frankfurt) took 5.3s → `expired transaction`. **Fix:** `db.$transaction(fn, { timeout: 20000, maxWait: 10000 })` + `export const maxDuration = 30` on `app/(app)/log/page.tsx`.

**`vercel logs` streaming DROPS `console.error` intermittently** — you can lose the real error. **Fix / technique:** to capture a failing Server Action fast, temporarily RETURN the error text to the client (`{ error: \`Save error — ${msg}\` }`) — DB/Prisma/pdf.js errors carry no personal data — read it on the owner's screen, then revert to a friendly message. `vercel inspect --logs <url>` shows **build** logs (e.g. `prisma migrate deploy`).

**Barcodes weren't linking** — root cause: **real Carrefour receipt barcodes fail the GTIN mod-10 check digit** (e.g. `071727355039`), and our validator was rejecting them → nothing stored → feature silently inert. **Fix:** `lib/barcode.ts` is now **lenient** — accept any 8–14 digit run, pad to GTIN-14, **no check-digit validation**. Don't re-add the check digit.

**`"use server"` files may only export async functions.** Pure helpers/resolvers (`resolveDraftIdentity`, `resolveManualIdentity`, `shouldDeleteOrphan`) live in `lib/*-match.ts`, imported by both the action and the tests. Don't move them into `app/actions/*`.

**Receipt trip date** is `DD-Mon-YYYY` (e.g. `26-Jun-2026`) on the line labelled **"Invoice Date"**. `extractReceiptDate` handles text-months with any separator and **anchors to the "Invoice Date" line** (there are other dates on the receipt). If a date parses wrong, get the exact printed format from the owner and extend it.

**"Bought twice" for one product is usually CORRECT** — same barcode on two receipt lines = one item, two purchases (multi-buy). Not a bug.

**PowerShell mangles `git commit -m` messages containing backticks / parentheses / slashes.** Write the message to a temp file and use `git commit -F <file>`.

**Prisma migrations** are hand-authored here (`prisma/migrations/N_name/migration.sql`, DB-free locally); `vercel-build` runs `prisma migrate deploy`. "No pending migrations to apply" in the build log is normal once a migration has already been applied on Neon.

---

*You are fully oriented. The app is **complete, live, and verified** (receipt import + v2 done, 103 tests). Remaining work is the optional polish in §5. Follow §1's rules and §8's playbook.*
