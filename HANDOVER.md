# 🤝 Shelfie — Session Handover (read this first)

**Purpose:** This is a cold-start handover. If you are a fresh session with no prior context, **read this document top to bottom — it contains everything you need: the rules, the way we work, the current state, and the exact next step.** Do not rely on external memory for rules or workflow; they are all here. For exhaustive detail, read `docs/MASTER-DOCUMENTATION.md` (the full reference).

---

## 0. 30-second orientation
- **Project:** Shelfie — a deliberately simple, single-user UAE grocery **price + budget tracker** (a much-simpler rebuild of an over-built app called FilsWise). 3 tabs, one 4-digit PIN, ~6 DB tables.
- **Live app:** https://shelfie-gamma-seven.vercel.app · **Hub:** https://xcloudy75z.github.io/shelfie/ · **Repo:** https://github.com/xCloudy75z/shelfie
- **Local working dir:** `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie` (NOT the stale `IDEAS\FilsWise#2`).
- **State (2026-07-13):** The whole app is **built, live, and working**. Shipped & verified on the owner's phone: receipt PDF import + Receipt Import v2; **Phase A — show the barcode** (bordered-chip barcode + red "NO BARCODE" flag on un-barcoded receipt rows); **Categories & discount accuracy** (Month budget reflects amount PAID = shelf − receipt discount; add/rename/delete categories; re-file items; unknown → "Uncategorized"); **Phase B — merge tool** (fold two items into one, choose surviving name, one-tap undo). Also shipped: the **hub redesign** (sidebar + build-timeline layout).
- **⏳ THE ONE OPEN ITEM — Phase C/D (camera scanning) is BUILT, double-break-reviewed, and LIVE, awaiting the owner's live verify on his iPhone (incl. the installed Home-Screen PWA).** The feasibility spike PASSED (his iPhone read a real EAN-13). He approved building it (C11). It adds `html5-qrcode` (dynamically imported), a `BarcodeScanner` overlay, and "📷 Scan" buttons on Log (scan → identify/prefill or new item) and Prices (scan → open the price story / "start tracking"). **His verify checklist is §5a.** **123 unit tests.** Once he signs off, the whole A→B→C/D roadmap is complete and the app is feature-complete. Roadmap/decisions: `polish-phases-decisions.txt`.

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

**⚠️ ADVERSARIAL "try to break it" is MANDATORY at ALL THREE ARTIFACTS — the SPEC, the PLAN, *and* the built APP CODE. This is not optional and is the owner's explicit requirement — it is what produces the golden version. Every one of the three must be attacked by a fresh, skeptical Opus subagent, and every finding folded in before moving on:**
1. **Break the SPEC** — before planning, a fresh skeptical Opus review attacks the *design* for correctness holes, edge cases, data-integrity and privacy risks. Fold findings in before writing the plan.
2. **Break the PLAN** — before any code, a fresh skeptical Opus review attacks the *plan* itself: wrong/invalid test fixtures, bad task ordering, framework gotchas (e.g. `"use server"` export rules, dynamic-import bundling), missed spec coverage. Fold findings in before building.
3. **Break the BUILD — TWICE (two INDEPENDENT passes, owner rule 2026-07-13).** After coding, run **two separate fresh skeptics with DIFFERENT lenses** — pass 1: correctness / data-integrity / bundling; pass 2: real-use UX / device edge cases / "what pass 1 missed." (In Phase C/D, pass 2 caught two blockers pass 1 declared SHIP — this is exactly why two passes are required.) Fix everything, then verify live on the real runtime.

**The full flow, every feature:** brainstorm → design approved → spec → **break-spec** → plan → **break-plan** → build (subagent TDD) → **break-build ×2** → **owner live-verifies on his phone**. A bug can survive spec + plan review and only die at build-review or the live run (e.g. the over-strict barcode validator; the Phase C/D new-item-scan barcode drop) — so **all four gates (3 breaks + live run) are required; none is optional.** Use the superpowers skills (brainstorming, writing-plans, subagent-driven-development, test-driven-development, verification-before-completion, systematic-debugging, requesting-code-review).

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
The owner works across **4 devices**: **① Local PC** (dev machine — git/build/deploy), **② iPhone = "Remote 1"** (his own phone; the **actual keeper / device of record**), **③ College PC = "Remote 2"**, **④ College phone (Android) = "Remote 3"** (a loaner — phones are barred in college, so at college he tests on this).
- **Live-verify targets whichever device the owner currently has** — he'll tell you (Android/Chrome at college, iPhone/Safari at home). Don't assume; ask or follow his cue. Install: Android = Chrome ⋮ → "Add to Home screen"; iOS = Share → Add to Home Screen.
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
Plan 1 (core, 16 tasks) + several extras, all shipped: PIN lock + throttle; **Log** (manual entry + mobile typeahead + item-identity confirm); **Prices** (unit-price verdict, offer-excluded, 3-sample gate, instant load); **Month** (pay-cycle budget/pace, category bars, edit/delete purchases); **Backup & Restore** (validated, snapshot+undo); **auto-update + version stamp**; **installable PWA + icons**. The receipt **parser** (`lib/receipt.ts`) is proven correct. **Receipt import + Receipt Import v2** shipped & verified live (2026-07-12): server-side PDF read on Vercel, barcode identity (two-way, **lenient** validation — real Carrefour codes fail the GTIN check digit), per-item offers, no-barcode flag, "same as"/detach linking, dual dedupe, multi-buy, auto-detected trip date, per-unit prices, scrollable Month purchases box, confirmation-gated **"Start fresh"** reset.

**Phases shipped 2026-07-13 (all verified on the owner's phone unless noted):**
- **Phase A — Show the barcode:** `displayBarcode()` un-pads the canonical GTIN to the printed form (strip padding → restore to nearest standard length 8/12/13/14); shown as a **bordered chip** on Prices + receipt review; un-barcoded receipt rows flag **red "NO BARCODE"** (`app/components/BarcodeLine.tsx`, `ItemMergeControl` unrelated). Files: `lib/barcode.ts` (`displayBarcode`), `BarcodeLine.tsx`.
- **Categories & discount accuracy:** Month "Spent"/budget = amount **PAID** (shelf − per-trip `ReceiptImport.discountFils`, derived from LIVE `Purchase.importId` so a delete/restore can't leave a phantom discount); items stay at shelf price; category chart stays shelf-based + footnote. Unknown items file as **Uncategorized** (`guessCategory` returns `string|null`). Add/rename/delete categories (`CategoryManager` on Month, reserved-name + case-insensitive guards) + re-file items (`ItemCategoryPicker` on Prices). `restoreBackup` wipes stale `ReceiptImport`. Migration `3_receipt_discount`. Files: `lib/categories.ts`, `lib/category-db.ts`, `app/actions/categories.ts`, `app/components/{CategoryManager,ItemCategoryPicker}.tsx`.
- **Phase B — Merge tool:** on the Prices item view, fold two items into one — owner taps which name to keep (survivor keeps name+category); the other's purchases + barcodes repoint to it, then it's deleted; **persistent "Merged ✓ · Undo" banner** (NOT a timed toast). `mergeItems`/`undoMerge` in `app/actions/merge.ts`; `lib/merge.ts` (`validateMerge`, `MergeUndo`); `app/components/ItemMergeControl.tsx`.
- **Hub redesign:** the front door (`docs/index.html`) is now a sidebar + build-timeline; the board (`docs/progress.html`) is append-only per-phase cards with preserved break-it findings; mockups under `docs/hub-mockups/`.

**Phase C/D — Camera scanning: BUILT + double-break-reviewed + LIVE, awaiting the owner's iPhone verify (§5a).** `html5-qrcode` (dynamically imported — stays out of the initial bundle), `app/components/BarcodeScanner.tsx` (GTIN-only formats, stop-on-read, portal overlay, hardened camera teardown), `lookupBarcode` in `app/actions/scan.ts`, `PriceScanButton.tsx`, and a 📷 button + `initialBarcode` hand-off wired into `PurchaseForm`/`log/page`/`prices/page`. `app/layout.tsx` got `viewportFit:"cover"`.

**123 unit tests green.** Every phase ran the full break-spec → break-plan → break-build(×2 from Phase B) workflow; findings preserved on the hub board.

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

## 5a. THE PENDING ITEM — Phase C/D camera scanning: owner live-verify (do this first)

Phase C/D is **built, double-break-reviewed, and live**. The owner will report back next session. **His verify checklist (he does this on his iPhone — Safari AND the installed Home-Screen PWA, the historically risky context):**
1. Log → **📷 Scan** a tracked item → its name **prefills** ("Recognized: …") → save.
2. Log → 📷 Scan a **NEW** item → the barcode stays, name blank → type name + price → save → item created **WITH the barcode**; scan it again → now "Recognized" (the teach-loop — a break-build fix; verify it works).
3. Prices → 📷 Scan a tracked item → its **price story** opens; scan an untracked one → **"No history yet — start tracking?"** → tap → lands on Log with the barcode prefilled.
4. Scanner shows **"Starting camera…"**, **stops on the first read**, camera light turns off on close.
5. **Confirm all of the above in the INSTALLED Home-Screen app**, not just Safari.

If any step fails, **root-cause first** (§1.5) — read the actual error; the camera errors surface in the overlay. Spec: `docs/superpowers/specs/2026-07-13-phase-cd-scanning-design.md`; plan: `plans/2026-07-13-shelfie-phase-cd-scanning.md`. If it's all good → mark the Phase C/D card done on the board + hub timeline, and the app is **feature-complete**.

Specs/plans for the shipped phases (for reference): Phase A `2026-07-12-phase-a-show-barcode-design.md`; Categories/discounts `2026-07-12-categories-and-discounts-design.md`; Phase B `2026-07-13-phase-b-merge-tool-design.md`. All under `docs/superpowers/specs/` with matching `plans/*.md`.

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
3. Sanity check: `cmd /c "npm install"` → `cmd /c "npm test"` (expect **123 pass**) → `cmd /c "npm run build"` (clean).
4. **First real task: the owner's Phase C/D live-verify result (§5a).** If he confirms it works → mark C/D done (board + hub) and the app is feature-complete. If he reports a problem → root-cause first (§1.5, §8). Everything else (A, accuracy, B, hub) is DONE — don't redo.
5. Keep the owner in the loop his way (§1.2): publish anything reviewable to the hub, use in-chat questions for decisions, push often, and **verify each deploy reached Ready** (§7, §8 — the git auto-deploy sometimes doesn't fire). Update `docs/progress.html` as you go, preserving per-phase cards + break-it findings (owner requirement — never overwrite/reorder shipped cards).
6. **Use PowerShell, not the Bash tool, for shell ops here** (the Bash/git-bash tool fails against this repo — §8). Any new feature runs the full break-it×3 workflow (§1.4).

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

### New playbook entries (2026-07-13 session — Phases A/accuracy/B/C-D + hub)

**Vercel git auto-deploy does NOT always fire on push.** More than once a `git push` reached GitHub (`git rev-parse origin/main` == HEAD) but Vercel created no new deployment for minutes. **Never assume push = deploy.** After every push, check `vercel ls shelfie` for a fresh Building/Ready row matching your commit. If none appears within ~2 min, **force it:** `cmd /c "vercel deploy --prod --force --yes"` (deploys the clean local working tree, aliases to production). Then confirm `vercel inspect <url>` → `status ● Ready` before telling the owner to test.

**The Bash tool is unreliable in this environment — use PowerShell.** `Bash`/git-bash calls to `cmd`, `vercel`, `git`, even `ls` frequently exited 1 with no output. Do ALL shell work (git, npm via `cmd /c`, vercel) through the **PowerShell** tool. Pattern that works: `Set-Location -LiteralPath "…\IDEAS\Shelfie"; git …; cmd /c "npm …"`.

**GitHub Pages lags ~1–2 min behind a push.** After pushing a hub/docs change, don't tell the owner it's live immediately — poll until the new content shows: `Invoke-WebRequest -Uri "https://xcloudy75z.github.io/shelfie/<page>?c=$i" -UseBasicParsing` in a short loop, check `.Content -match "<some new string>"`. New sub-folders (e.g. `hub-mockups/`) 404 until Pages rebuilds.

**Poll-loop gotcha:** matching `status ● Ready` from `vercel inspect` output in a regex is finicky (the `●` char). Match `"Ready"`/`"Error"` loosely, or just read the block. Foreground `sleep` is blocked by the harness — poll external state with a check command in a short PowerShell `for` loop (short `Start-Sleep` inside is OK).

**TWO break-build passes catch what one misses.** In Phase C/D, pass 1 (data/correctness lens) said SHIP; pass 2 (real-use/UX lens) found **two blockers** — always run two INDEPENDENT skeptics with different emphases (see §1.4). Same in Phase B (pass 2 caught the silent 2-item merge + 4s-undo).

**Camera / html5-qrcode lessons (Phase C/D):**
- iOS Safari has **no native `BarcodeDetector`** — use the `html5-qrcode` JS fallback (it worked on the owner's iPhone, reading EAN-13). The throwaway spike is `docs/scan-test.html`.
- **Dynamic-import the lib** (`await import("html5-qrcode")`) and **destructure BOTH the class AND the format enum** from it — a top-level `import` of even the enum re-adds the browser-only lib to the initial/SSR bundle. Verified via build route sizes (must stay async chunk).
- **GTIN-only formats** (`EAN_13/EAN_8/UPC_A`). Do NOT enable `CODE_128/CODE_39` (a shelf-edge label decodes to a bogus "barcode") or `UPC_E` (`canonicalizeBarcode` doesn't expand UPC-E→UPC-A, so it won't match stored codes).
- **Camera-teardown race:** stop the **captured** instance, never a ref another path may have nulled, or the camera stays live (light on, "camera in use" on reopen). Portal the full-screen overlay to `document.body` (a parent `.rise` transform otherwise becomes the containing block and boxes a `position:fixed` overlay).
- **Scan identity:** only arm "clear the scanned barcode when the name is edited" for a **recognized** barcode; for a NEW item leave it so typing the name keeps the barcode (else the new item saves with no barcode and never gets recognized).

**Discount accuracy:** derive the netted total from **live `Purchase.importId`**, NOT a denormalized `monthKey` on `ReceiptImport` — the denorm version left a phantom discount after deleting/restoring an imported item (break-spec caught it).

**Merge tool:** `Barcode.itemId` FK is `ON DELETE Cascade` (Purchase is `Restrict`) — you MUST move purchases + barcodes to the survivor **BEFORE** `item.delete`, or the merged item's barcodes are silently cascade-deleted. Merge undo must tolerate a re-taken name (fold into the existing same-name item) and a deleted category (restore as Uncategorized).

**Categories:** `guessCategory` now returns `string | null` (null → Uncategorized). "Uncategorized"/"Other" are reserved names; uniqueness is case-insensitive via `findOrCreateCategory` (`lib/category-db.ts`) so the auto-create paths can't spawn case-variant dupes. Pure category helpers live in `lib/categories.ts` (client-safe — imported by `PurchaseForm`); anything touching the DB lives in `lib/category-db.ts`.

---

*You are fully oriented. The app is **feature-complete pending one live check** (Phase C/D — §5a). A/accuracy/B/hub are shipped & verified; **123 tests**. Follow §1's rules (esp. §1.4 break-it×3 + break-build×2, and use PowerShell not Bash) and §8's playbook.*
