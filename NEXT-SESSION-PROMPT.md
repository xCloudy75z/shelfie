# Starter prompt for the next Shelfie session

*(Paste everything below into the new session.)*

---

We're continuing an existing project called **Shelfie** — a deliberately simple, single-user UAE grocery price + budget tracker (live on Vercel).

Before doing ANYTHING or asking me anything, **read the handover top to bottom** — it has ALL the rules, how I work, the full project state, the repo map, and a **troubleshooting playbook of issues already solved** (so we don't spend 100 iterations rediscovering them):

  `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie\HANDOVER.md`

Then skim the full reference for depth: `docs\MASTER-DOCUMENTATION.md`

Non-negotiable rules to internalize from the handover (don't rely on assumptions or memory — take them from the doc):
- **ALL OPUS** — every step and every spawned subagent/workflow runs on Opus.
- **I'm remote and only see live web pages** — publish anything reviewable to the hub (GitHub Pages `/docs`) and give me the URL; in-chat multiple-choice questions are fine for decisions.
- **Privacy is top-critical** — never read or save my personal data (name, card/loyalty numbers, email, phone, address, receipt/transaction IDs, cashier). Product names, prices and product barcodes are NOT personal; my identity is. Never handle the DB password.
- **How we build:** brainstorm → spec → bite-sized TDD plan → subagent-driven dev (a fresh Opus subagent per task, strict TDD) → verify the real thing runs. **NO code before an approved design.** Adversarially **"try to break it" at ALL THREE — the SPEC, the PLAN, and the built APP CODE** — and the build gets **TWO independent break passes** — before I verify live on my phone. None of these is optional.
- **Keep the hub + docs updating live** — the progress board is append-only per-phase cards with preserved "break-it" findings; never overwrite or reorder shipped cards.
- **Use PowerShell, not the Bash tool**, for git/npm/vercel. **Verify every Vercel deploy reached Ready** — the git auto-deploy doesn't always fire; if it doesn't, force it: `vercel deploy --prod --force --yes`.
- Systematic debugging (root cause first — read the real error), build cadence (core → prove live → check in), destructive DB actions confirm first.

Work ONLY in `C:\Users\games\Documents\xCloudy\IDEAS\Shelfie` (always `Set-Location -LiteralPath` there first — the shell may default to a stale, empty folder). Run npm/npx/vercel via `cmd /c "..."`. Commit + push often (every push auto-deploys; verify Ready before asking me to test).

**Current state:** the app is **feature-complete pending ONE live check** — Phase C/D (camera scanning) is built, double-break-reviewed, and live, awaiting my verify (handover **§5a**). Everything else — Phase A (show barcode), Categories & discount accuracy, Phase B (merge tool), and the hub redesign — is shipped and verified on my phone. **123 unit tests green.**

**First thing:** I'll give you my **Phase C/D live-verify result** — handle it per §5a (if it works → mark the C/D card done on the board + hub, app is feature-complete; if there's a problem → root-cause it first).

**Also — IMPORTANT:** after you've read the handover, **if you have ANY questions that only the previous session (the one that built all of this) can answer, prepare a clear, numbered question list and give it to me** so I can relay it to that session. (That's how this project hands off cleanly between sessions — the previous session can answer anything that isn't obvious from the docs.)

Then give me a **3-bullet summary**: (1) where the project stands, (2) what you understand the pending Phase C/D verify to be, and (3) any questions for the previous session — then wait for my go.
