<!-- Single-page rendered view of the portable PLAYBOOK/ folder (lives at the repo root). -->

# The Playbook — a portable way of working

> The exact system used to build **Shelfie** (a single-user grocery price + budget tracker), packaged so **any project — old or new — can be run the same way.** Shelfie is the worked example throughout; the method is project-agnostic.

This folder is meant to be **copied into a project** (or kept as a reference beside it). Read `README.md` first, then the numbered files in order. The `templates/` folder holds copy-paste starters.

---

## The one-paragraph philosophy

Build **one small, testable slice at a time**; never write code before the design is approved; and **attack every artifact — the design, the plan, and the built code — with a fresh, skeptical reviewer before trusting it.** Keep a **living, web-viewable record** so a remote owner can see and judge everything as real web pages. Prove it works on the **real device**, not just in tests. The result is slow-looking but fast-in-truth: bugs die at the design stage instead of in production.

---

## The flow (every feature, start to finish)

```
  IDEA
   │
   ▼
① BRAINSTORM ──────────── one question at a time; YAGNI; propose 2–3 options; agree a design
   │                       (no code yet)
   ▼
② SPEC ────────────────── write the design down (docs/superpowers/specs/…)
   │
   ▼
🛡 BREAK THE SPEC ──────── fresh skeptic attacks the DESIGN for holes → fold findings in
   │
   ▼
③ PLAN ────────────────── bite-sized, test-first tasks with exact code (plans/…)
   │
   ▼
🛡 BREAK THE PLAN ──────── fresh skeptic attacks the PLAN (fixtures, ordering, gotchas) → fold in
   │
   ▼
④ BUILD ───────────────── one fresh subagent per task, strict TDD: failing test → pass → commit
   │
   ▼
🛡 BREAK THE BUILD ×2 ──── TWO independent skeptics, different lenses (correctness // real-use)
   │                       then a short confirm pass on the fixes → fold everything in
   ▼
⑤ LIVE-VERIFY ─────────── the owner runs it on the REAL device and signs off
   │
   ▼
  SHIPPED   (docs + hub kept live the whole way)
```

**Four gates, none optional:** break-spec, break-plan, break-build ×2, and the live run. A bug can survive three of them and die at the fourth — that is exactly why all four exist. (On Shelfie, break-build pass 2 repeatedly caught blockers that pass 1 had cleared.)

---

## The five principles behind it

1. **No code before an approved design.** Thinking is cheaper than typing. Every project — however "simple" — gets a design first.
2. **Adversarial by default.** Every artifact is assumed broken until a fresh skeptic fails to break it. Reviews are hostile on purpose.
3. **The remote owner sees only web pages.** Nothing is "approved" until the owner has seen it in a browser. Everything reviewable is published to a hub as HTML; decisions are asked as in-chat multiple-choice.
4. **Prove it on the real thing.** Passing tests ≠ working app. The owner verifies on the actual device (for Shelfie: an iPhone, including the installed home-screen app).
5. **Docs are live, not a finale.** The progress board and docs update *as work happens*, append-only, with every break-it finding preserved.

---

## How to use this folder

| File | What it gives you |
|------|-------------------|
| `README.md` | This overview — the philosophy and the flow. |
| `01-rules.md` | The non-negotiables (model, privacy, decision authority, cadence, comms). |
| `02-workflow.md` | Each stage in detail + subagent-driven development + TDD. |
| `03-stress-tests.md` | **The secret sauce** — how to break each artifact, with paste-ready skeptic prompts. |
| `04-documentation.md` | The doc system: what exists, where it lives, when it updates. |
| `05-hub-and-review.md` | The GitHub Pages hub + how a remote owner reviews via HTML. |
| `06-mockups-and-illustration.md` | Clickable mockups before code; the design system; diagrams. |
| `07-scope-and-bundles.md` | How to define and slice scope into shippable bundles. |
| `08-bootstrap-checklist.md` | Cold-start a new (or existing) project onto this system. |
| `templates/` | Copy-paste starters for every artifact above. |

**To start a new project:** copy this `PLAYBOOK/` folder in, then follow `08-bootstrap-checklist.md`.


---

# 01 — The rules (non-negotiables)

These hold on every project. Adapt the *specifics* (which model, which currency) but keep the *shape*.

## 1. Model discipline
- **Pick a model policy and hold it.** On Shelfie: **all Opus, every step and every subagent** — passed explicitly when dispatching subagents. The point is consistency and quality over cost.
- A common split (if you want one): a stronger model for *planning / hard debugging / recommendations*, a fast model for *mechanical execution*. Never mix models within a single stage. If execution hits an unexpected wall, escalate back to the planning model.

## 2. Privacy is top-critical (absolute)
- **Never read, recognise, or store the owner's personal data** — name, card/loyalty numbers, email, phone, address, transaction/receipt IDs. If you cross any, discard it immediately; never write it to memory.
- **Don't open a file that may contain personal data raw.** Extract only the non-personal structure via a script that **redacts before you see it** (e.g. keep product/price lines, mask any long digit-run, drop personal keywords, delete the raw immediately). *Content* like product names + prices is not personal; the owner's *identity* is.
- **Never handle secrets** — DB passwords, API keys, session secrets. The owner sets those in the host dashboard himself. The repo holds only code + mockups; real data/secrets are hard-blocked in `.gitignore`.

## 3. Decision authority
| Situation | Rule |
|-----------|------|
| Bug fixes, small improvements, refactors, tests, docs | **Do automatically** |
| New feature design, architecture change, removing a feature | **Ask the owner first** |
| New tool/service, any cost, scope/timeline change | **Ask first** |
| Changing a *locked* decision or bundle sequence | **Ask first** |
| Deleting files | Show the full list → get explicit approval → confirm done |
| Destructive data ops (wipe/reset/drop) | **Always confirm first** |
| Requirements unclear | **Stop and ask** — never assume |

## 4. Build cadence
Never build everything in one autonomous run. **Build the core happy-path, package it into a real runnable artifact early, verify the real thing runs, then stop and check in** before layering more. Tests passing is *not* proof the app runs — launch the actual thing.

## 5. Locked decisions
Every project accumulates **locked design decisions**. Treat them as immutable. To change one: surface it, get explicit approval, then update the record. Write them down where they can't be missed (the project's registry/handover).

## 6. Destructive actions confirm first
Any delete/reset/wipe shows a confirmation before executing, and is built confirmation-gated in the UI. For actions that are hard to reverse or outward-facing (sending, publishing, purchasing), confirm first unless already authorised.

## 7. Communication
- **Plain English first**, the *why* before the *what*, short scannable messages (headings, bullets, numbered steps).
- **Honest about failures** — show the evidence (real output), never claim done without proof.
- **Status icons only in checklists/summaries** (✅ done · 🟡 in progress · ❌ blocked/not started), not in prose.
- **Report outcomes faithfully:** if tests fail, say so with the output; if a step was skipped, say that; when something is verified, state it plainly without hedging.

## 8. Device & testing model
- Know your **device of record** — the real device the owner keeps and judges on (Shelfie: an iPhone, incl. the installed home-screen app). **Live-verify targets the real device**, not a simulator or the dev machine.
- If the owner is **remote**, he sees only live web pages — so everything reviewable is published to the hub (see `05-hub-and-review.md`), and decisions are asked as in-chat multiple-choice.


---

# 02 — The workflow (each stage in detail)

The full flow is in `README.md`. This file explains what happens at each stage and how to run it. The gates (break-spec/plan/build) have their own file: `03-stress-tests.md`.

## The "superpowers" skills behind this

This method runs on a reusable library of **"superpowers" skills** — named, packaged procedures you invoke per stage instead of improvising. You don't need that exact library, but the *mapping* is the system: every stage has a named, repeatable procedure, so quality doesn't depend on remembering to be careful.

| Stage | Skill it uses |
|-------|---------------|
| Brainstorm → agreed design | `brainstorming` (one question at a time, YAGNI, present + approve) |
| Write the plan | `writing-plans` (bite-sized, test-first, exact code) |
| Build each task | `test-driven-development` + `subagent-driven-development` (or `executing-plans` for inline) |
| Every break-it gate | the skeptic prompts in `03-stress-tests.md` (a.k.a. `requesting-code-review`) |
| Any bug or surprise | `systematic-debugging` (root cause before fix) |
| Before claiming "done" | `verification-before-completion` (evidence, not assertion) |
| Isolated / parallel work | `using-git-worktrees` |

## ① Brainstorm → an agreed design
- **One question at a time.** Don't dump ten questions; ask, listen, refine. Prefer multiple-choice — easier to answer, and it works for a remote owner in chat.
- **YAGNI ruthlessly.** Cut every feature that isn't load-bearing. "Simple" projects need this most — that's where unexamined assumptions waste the most work.
- **Propose 2–3 approaches** with trade-offs and a recommendation; lead with the one you'd pick and say why.
- **Present the design in sections** scaled to complexity; get an OK on each before moving on.
- **Hard gate:** no code, no scaffolding, no implementation until the owner approves the design — *every* project, however small.

## ② Spec → write the design down
- A short design doc (`docs/superpowers/specs/YYYY-MM-DD-<topic>.md`): motivation, current behavior to preserve, the new behavior, architecture, edge cases, non-goals, testing approach, success criteria.
- Then **🛡 break the spec** (`03-stress-tests.md`), fold findings in.

## ③ Plan → bite-sized, test-first tasks
- A detailed plan (`plans/YYYY-MM-DD-<feature>.md`) written for an engineer with **zero context**: exact file paths, **complete code in every step** (no "TODO"/"add error handling here"), exact commands with expected output.
- **Granularity = one action per step:** write the failing test · run it, see it fail · write the minimal code · run it, see it pass · commit.
- Then **🛡 break the plan**, fold findings in.

## ④ Build → subagent-driven development, strict TDD
- **One fresh subagent per task** (keeps each context small and focused), or execute inline for small work — both are valid. Review between tasks.
- **TDD, every task with testable logic:** write the failing test → run it and confirm it fails for the right reason → write the minimal implementation → run it and confirm it passes → commit.
- **Don't invent hollow tests.** A pure-presentation change may have no new unit logic — say so, and lean on typecheck + build + the existing suite + the live run instead. (But look hard first: there's often one extractable pure helper worth a test.)
- **Commit frequently**, one logical change at a time, with a clear message.
- Then **🛡 break the build ×2 + confirm** (`03-stress-tests.md`), fold everything in, re-run the checks.

## ⑤ Live-verify → the owner runs the real thing
- **Passing tests ≠ a working app.** The owner exercises the actual flow on the real device and signs off. Give a short, numbered checklist of exactly what to tap and what to expect.
- If anything fails, **root-cause before fixing** (see below). A finding here is normal — it's the last gate for a reason.

---

## Two disciplines that run *through* every stage

### Verification before completion
Never claim "done / fixed / passing" without running the command and reading the output. **Evidence before assertions, always.** If you didn't see it work, it isn't done.

### Systematic debugging (no fix without root cause)
When something breaks: **read the actual error, reproduce it, instrument the boundary, form ONE hypothesis, test the smallest change, verify.** Don't guess-and-patch. If three fixes in a row fail, **question the architecture** — the bug may be structural. (On Shelfie this is what moved PDF reading from the device to the server after seven failed device-side attempts.)

---

## Keep it live the whole way
Docs and the hub board update **as the work happens**, not at the end — every stage, every finding. See `04-documentation.md` and `05-hub-and-review.md`. The owner watches the board; push after each meaningful step so it reflects reality.

## Scale to the task
A one-line fix doesn't need a five-stage ceremony — but it still gets a root-cause and a verification. A new feature gets the full flow. When unsure, lean toward more rigor for anything users touch.


---

# 03 — The stress tests (the secret sauce)

This is the part that makes the difference. **Every artifact is attacked by a fresh, skeptical reviewer before it is trusted.** Not a friendly "looks good" — a hostile "here's how it breaks."

There are **four gates**, and **none is optional**:

1. **Break the SPEC** — attack the *design* before planning.
2. **Break the PLAN** — attack the *plan* before any code.
3. **Break the BUILD ×2** — two *independent* skeptics attack the *code*, with different lenses, then a short confirm pass on the fixes.
4. **Live-verify** — the owner runs it on the real device.

## Why it works

- **A bug can survive three gates and die at the fourth.** On Shelfie, a design passed break-spec and break-plan, then break-build pass 2 found a blocker (the Save button hidden behind the mobile keyboard) that pass 1 — a pure-correctness review — structurally could not see. Different lenses catch different failures.
- **Fresh eyes only.** Each reviewer starts cold, with no attachment to the work. Never let the author review their own artifact.
- **Findings are folded in, then recorded.** Every finding is either fixed or explicitly de-scoped with a reason. Then it's preserved on the hub board forever (append-only) — the findings *are* the owner's review record.

## The rules of a break-it pass

- **Assume it's broken.** The reviewer's job is to find the failure, not to bless the work.
- **Be specific.** Every finding = a **severity** (Blocker / Major / Minor / Nit), a **concrete failure scenario** (real inputs → wrong result), and a **minimum fix**.
- **Verify against the real code.** The reviewer reads the actual files, not just the artifact — it confirms signatures, counts, and assumptions.
- **Rank most-severe first**, and end with a one-line verdict (SHIP / NEEDS-FIX, or "sound to proceed").
- **The reviewer does not edit** — it reports. The author folds findings in.
- **Run reviewers as fresh subagents** (for this system: Opus). For break-build, run the two passes **concurrently** but with *different* emphases.

---

## Template A — Break the SPEC

> Paste this to a fresh reviewer. Replace `«…»`.

```
You are a fresh, skeptical senior engineer doing an ADVERSARIAL "try to break it"
review of a DESIGN SPEC (no code yet). Find correctness holes, edge cases,
data-integrity risks, privacy risks, device/mobile pitfalls, accessibility gaps,
and spec ambiguities BEFORE any code is written. Be harsh and specific. Do not be
agreeable. Verify against the real code — read the files.

Context: «one paragraph: what the product is, the stack, the target device/runtime,
and any hard-won prior lessons that constrain the design».

READ: «the spec file path», plus «the current code the change touches» and «any
reference files that show the patterns to mirror».

The change (summary): «2–4 sentences».

Attack at least: interaction correctness · data integrity · the target device/runtime
· privacy · accessibility · spec ambiguities/contradictions/missing states · anything
the spec claims is "unchanged" that the change actually affects. Go beyond this list.

Output: a numbered list, most-severe first. Each finding: SEVERITY (Blocker/Major/
Minor/Nit), the concrete failure scenario, and the minimum fix. End with a one-line
verdict: sound to proceed to planning (with fixes folded in), or needs rework.
Do NOT write code. Do NOT edit files.
```

## Template B — Break the PLAN

```
You are a fresh, skeptical senior engineer doing an ADVERSARIAL review of an
IMPLEMENTATION PLAN (not code yet). Find everything that would make a
competent-but-context-free engineer BUILD THE WRONG THING or hit a wall: wrong or
invalid test fixtures, bad task ordering, framework gotchas, type/signature
mismatches, missed spec coverage, and any code in the plan that won't compile or
won't behave as claimed. Verify against the real code — read the files.

Context: «stack, conventions, how to run tests, the target runtime».

READ: «the plan file», «the spec it must fully cover», «the current code it
replaces» (confirm nothing behavioral is dropped), and «the action/API files it
calls» (confirm signatures + return types match EXACTLY how the plan's code calls
them).

Attack at least: compilation under strict types · server/client boundary rules ·
test validity (do the fixtures fail-then-pass? is the test count credible?) ·
behavior parity vs the code being replaced · runtime correctness of any new logic ·
task ordering & commit hygiene · spec-coverage gaps. Go beyond this list.

Output: numbered findings, most-severe first — SEVERITY, the concrete problem
(quote the plan/code), the exact fix. End with a one-line verdict: ready to execute
(with fixes folded in) or needs rework. Do NOT write code or edit files.
```

## Template C — Break the BUILD (run TWO, concurrently, different lenses)

**Pass 1 — correctness / data / lifecycle lens:**

```
You are a fresh skeptical engineer doing ADVERSARIAL break-build review PASS 1.
LENS: correctness, data integrity, state management, behavior parity vs the code it
replaced, bundling/SSR, and memory/lifecycle bugs. Assume it's broken; find how.
Verify against the real files.

READ: «the new/changed files», «the action/API files» (confirm calls unchanged),
«the prior version» (git history) to compare parity.

Attack at least: behavior parity (anything dropped?) · state correctness (stale
state, resets, races) · lifecycle/leaks (every listener/lock restored on unmount?
setState-after-unmount?) · bundling/SSR boundaries · the specific new logic. Quote
code + line numbers.

Output: numbered findings, most-severe first — SEVERITY, concrete failure scenario,
minimum fix. End with a verdict: SHIP or NEEDS-FIX. Do NOT edit files.
```

**Pass 2 — real-use / device / UX lens:**

```
You are a fresh skeptical engineer AND demanding «target-device» UX reviewer doing
ADVERSARIAL break-build review PASS 2. Your explicit job is to find what a
correctness-focused Pass 1 would MISS: real-use behavior on the actual device,
platform quirks, visual/interaction rough edges, and confusing UX. Assume the user
hits the worst case. Verify against the real files.

Context: «the exact device/runtime and its known quirks» (e.g. mobile keyboard
covering content, safe-area insets, no hardware keyboard, touch vs click).

READ: «the new/changed files», «the styling/tokens», «the page it lives in».

Attack at least: «device keyboard / input behavior» · «safe areas / installed-app
layout» · confusing or silent interactions · visual polish in light AND dark ·
scroll/overlay interplay · anything a real user does that breaks or annoys.
Explicitly flag anything Pass 1 would not have caught.

Output: numbered findings, most-severe first — SEVERITY, the concrete real-use
scenario, the minimum fix. End with a verdict: SHIP or NEEDS-FIX. Do NOT edit files.
```

**Confirm pass (after fixing pass 1 + 2):**

```
You are a fresh skeptical engineer doing a FOCUSED CONFIRMATION review of bug fixes
(not a full re-review). «Describe the blocker/major that were fixed and how.»
Confirm each fix actually resolves the issue AND introduced no new regression. For
each fixed issue give a verdict line — RESOLVED / NOT-RESOLVED / PARTIALLY — with a
one-sentence why. Then list any NEW issues (severity + fix) or "no new regressions
found." Keep it tight. Do NOT edit files.
```

---

## After every pass

1. **Fold each finding in** — fix it, or de-scope it *explicitly* with a one-line reason (never silently drop one).
2. **Re-run the checks** (tests / typecheck / build) so the fixes are proven, not assumed.
3. **Record the findings on the hub board**, append-only, in plain English — this is the owner's review trail. See `05-hub-and-review.md`.
4. Only then move to the next gate.

> **Scale the intensity to the task.** A tiny change gets a lighter touch; a risky or far-reaching one gets the full battery. But for anything non-trivial, the four gates are the default, not the exception.


---

# 04 — Documentation (the doc system)

Docs on this method are **written continuously, as the work happens** — never bolted on at the end. This file explains what documents exist, where each lives, and when each updates. The hub that *renders* these docs for a remote owner has its own file: `05-hub-and-review.md`.

## The one principle: docs are LIVE, not a finale

The old habit is "build the thing, then write it all up." We don't do that. Here the docs and the progress board move **in lockstep with the code** — every stage, every finding, every shipped slice updates them.

Why it matters:

- **The owner reviews through the docs.** A remote, non-technical owner can't watch your terminal — he watches the hub. If the board says a phase is green but the code isn't done, the board is lying to him. Stale docs aren't "slightly behind," they're **wrong**.
- **A fresh session must survive on the docs alone.** Contexts run out; sessions restart. The next session (human or AI) reads the handover cold and must be fully oriented. That only works if the doc reflects reality *now*, not reality three features ago.
- **Writing-as-you-go is cheaper.** Reconstructing "what did we decide and why" a week later costs more than jotting it when it's fresh — and you get it wrong.

Practical rule: after each meaningful step, update the relevant doc and push. Treat "I finished the code" and "I updated the doc + board" as **one** task, not two.

## The doc types

Six document types cover a project end to end. Not every project needs all six (see the minimum-viable note at the bottom) — but each has a fixed purpose, home, and update trigger.

| Doc | Purpose | Where it lives | Updates when |
|-----|---------|----------------|--------------|
| **Spec** | The approved design for one feature — the *what* and *why*, agreed before any code | `docs/superpowers/specs/YYYY-MM-DD-<topic>.md` | Written after brainstorm; hardened by break-spec; frozen once building starts |
| **Plan** | The bite-sized, test-first build recipe with exact code | `plans/YYYY-MM-DD-<feature>.md` | Written from the spec; hardened by break-plan; frozen once building starts |
| **Handover** | The cold-start doc a fresh session reads top-to-bottom | `HANDOVER.md` at repo root | Kept current — after every shipped feature and every solved gotcha |
| **Master doc** | The exhaustive reference (architecture, data model, every feature, decisions, history) | `docs/MASTER-DOCUMENTATION.md` | After each feature ships, or a decision/architecture changes |
| **Session log** | One file per work session — goal, what got done, next steps | `sessions/YYYY-MM-DD_session-N_slug.md` | At the end of each work session |
| **Bundle/build log** | Append-only running log of each session/bundle | `BUNDLE_LOG.md` at repo root | Appended once per session/bundle — never edited in place |

### Spec — the approved design
Short and focused on **one** feature: motivation, current behaviour to preserve, the new behaviour, architecture, edge cases, non-goals, testing approach, success criteria. It is the output of the brainstorm (`02-workflow.md` ①–②) and the input to the plan. It is **hardened by break-spec** before planning, then treated as frozen. On Shelfie every feature has one, e.g. `docs/superpowers/specs/2026-07-13-phase-b-merge-tool-design.md`.

### Plan — the build recipe
Written for an engineer with **zero context**: exact file paths, complete code in every step (no "TODO / add error handling here"), exact commands with expected output, one action per step (failing test → see it fail → minimal code → see it pass → commit). **Hardened by break-plan** before any code. Shelfie example: `plans/2026-07-13-shelfie-phase-b-merge-tool.md` pairs with the spec above — same date, matching slug.

### Handover — the cold-start doc
The single most important doc for continuity. A fresh session reads it **top to bottom** and is fully oriented from it alone. It carries five things:

1. **The rules** — model policy, privacy, decision authority, the build workflow (self-contained, not "see elsewhere").
2. **The current state** — what's built and live, what's pending, what not to redo.
3. **The repo map** — where things are (`lib/`, `app/actions/`, `docs/`, `plans/`).
4. **The exact next step** — the one task the next session should pick up.
5. **A troubleshooting playbook** — every gnarly issue already solved, with the fix (see below).

Shelfie's `HANDOVER.md` opens with a 30-second orientation and ends with "You are fully oriented." That is the bar: a cold session needs nothing else to start safely.

### Master doc — the exhaustive reference
Where the handover is "just enough to start," the master doc is "everything." Architecture, full data model, every feature in detail, all locked decisions, the adversarial-review findings, the build history. The handover *points to* it for depth (`docs/MASTER-DOCUMENTATION.md`).

### Session log & bundle log — the running trail
- **Session log:** one file per session capturing the goal, what was done (✅ done / 🟡 partial / ❌ failed), files created/modified **with full paths**, bundle status, blockers, the next 3 tasks, and a one-paragraph handoff so a cold session is oriented from that file alone.
- **Bundle log:** a single append-only file with one short entry per session/bundle — status before/after, milestones touched, files changed, decisions made, next step.

These two are lightweight and optional for small projects — but on any multi-session build they're what lets you reconstruct *when* and *why* something happened.

## Naming discipline

Filenames are **descriptive and dated** — never an auto-generated slug. A future reader (or you, in six months) should know what a file is from its name alone.

| | Example |
|---|---|
| ✅ Do | `bundle-3-1-excel-import.md`, `2026-07-13-phase-b-merge-tool-design.md`, `feature-auth-flow.md` |
| ❌ Never | `synthetic-juggling-rabin.md`, `plan.md`, `notes-final-v2.md` |

Specs and plans share a **date + slug** so a spec and its plan visibly pair up (see the Phase B example above). Session files add a short slug after the session number: `2026-07-13_session-4_phase-b-merge.md`.

## Append-only for findings

Two things are **never overwritten or reordered** — they are the owner's review trail:

- **Break-it findings.** Every finding from break-spec / break-plan / break-build is preserved where it was recorded, even after it's fixed. The point isn't the current state — it's the *evidence* that each artifact was attacked and survived.
- **Shipped progress cards.** Each phase keeps its own permanent card on the hub board, in fixed order. New work adds a new card; it never rewrites or rearranges an old one.

When something is fixed, you *append* the resolution — you don't delete the finding. The mechanics of the board and cards live in `05-hub-and-review.md`; the rule here is simply: **history is additive.**

## The troubleshooting playbook

When a genuinely hard problem is finally solved, **write down why it happened and the exact fix** — before you move on. The goal is that a future session never burns hours re-debugging a problem you already cracked.

Each entry is three lines: **the symptom**, **the root cause**, **the exact fix (and what NOT to try again)**. Keep it in the handover so a cold session sees it. Patterns worth recording (drawn from Shelfie, described in spirit):

- **A library that works locally but crashes in serverless.** A PDF-reading library ran perfectly in local Node but threw on the deploy platform because a native dependency wasn't in the bundle. Fix: install pure-JS shims before importing it; and note "do NOT try to bundle the native package — that path failed."
- **A silent database timeout.** A batch write of ~90 rows blew past the ORM's default 5-second transaction timeout and failed with a vague "couldn't save." Fix: raise the transaction timeout and the function's max duration; record the exact numbers.
- **A platform quirk.** "Push to git does not always trigger a deploy." Fix: after every push, verify a fresh build appeared; if not, force a deploy. Recorded so nobody assumes push = live again.

The test for "does this belong in the playbook?": *if a smart person could spend an hour rediscovering it, write it down.* Describe the **pattern and the fix**, never any personal data.

## Minimum viable docs for a small project

Not every project earns all six documents. A tiny tool doesn't need a master doc or a bundle log. But **three are non-negotiable, always**:

1. **A spec** — even one page. No code before an approved design, however small the project (`02-workflow.md`).
2. **A live progress view** — one page the owner can look at that reflects reality now (`05-hub-and-review.md`).
3. **A handoff** — enough that a cold session (or a future you) can pick it up: the rules, the current state, the next step.

Add the master doc, session logs, and bundle log as the project grows past a few sessions. Start light, stay live.


---

# 05 — The hub & how a remote owner reviews

The owner isn't sitting next to the machine. He works **remotely**, and the only thing he can reliably open is a **web page in a browser** — not local files, not a dev preview on `localhost`, not a tool's inline widget, not a screenshot pasted into chat history he has to scroll back to. So the whole system rests on one hard rule:

> **Nothing is "approved" until the owner has seen it as a live web page.**

Everything reviewable — the design, the mockup, the adversarial findings, the build progress — is **published as HTML to a hub** the owner can reach from his phone. The only other channel that works for a remote owner is an **in-chat multiple-choice question**: short, tappable, no typing. Those two together — *published page* + *multiple-choice ask* — are the entire review loop.

## Why this shape, not the obvious alternatives

- **Why not just show him the code / a diff?** He's non-technical and remote. A diff is not a review surface for him. A rendered page is.
- **Why not a dev preview?** A `localhost` preview only exists on the build machine. The owner can't open it. Anything he must review has to be on a public URL.
- **Why not screenshots in chat?** They go stale, they're not interactive, and he can't click into a mockup or expand a finding. A real page can.
- **Why multiple-choice for decisions?** It's the one input a remote, non-technical owner can give instantly and unambiguously. Open-ended "what do you think?" stalls; "A, B, or C?" ships.

---

## The pages (each one is a real URL)

The hub is a small set of static HTML files served by **GitHub Pages out of the repo's `/docs` folder** — push to the default branch and the folder *is* the website. No build step, no server.

| Page | File | What the owner does there |
|------|------|---------------------------|
| Front door / hub | `docs/index.html` | The lobby — a sidebar links to the live app, the docs timeline, and the tools below. Start here. |
| Live app | (Vercel URL) | The actual working app, linked from the hub — the real thing, not a preview. |
| Interactive mockup | `docs/mockup.html` | Click through the proposed screens **before any code exists** (see `06`). |
| Design spec | `docs/spec.html` | The written design in plain English — what's being built and why. |
| Adversarial review | `docs/review.html` | The break-it findings written up long-form (the owner's deep-review record). |
| **Build progress** | `docs/progress.html` | **The primary review surface** — the live board of every phase. Detailed below. |
| Master doc | `docs/masterdoc.html` | The full "how it all works" reference, kept current. |

All of these share **one design system** — a tokens stylesheet + a theme script (`templates/tokens.css` is the generic starter; Shelfie's were `docs/shelfie.css` + `docs/theme.js`) — so the hub *looks like the app*; reviewing the hub is itself a taste of the product's look and feel.

---

## The progress board in detail — the owner's main window

`docs/progress.html` is where the owner spends his review time. It's built to be glanceable and trustworthy:

- **It auto-refreshes.** A `<meta http-equiv="refresh" content="60">` reloads the page about every 60 seconds, so a board left open on his phone keeps catching up as work lands — he never has to manually reload to see the latest.
- **A progress tally + a status chip per phase.** The top shows `✓ N shipped · ◐ N in progress · ◦ N queued`, and each phase card carries a **Shipped / In progress / Queued** badge and a colored left border (green / amber / grey). Progress is readable in one second.
- **Append-only, persistent, fixed-order cards.** This is the core discipline. Every phase or build gets its **own permanent card**, added to the *end* of the list. You **never overwrite a shipped card and never reorder them** — you only update a card's own fields in place while it's active. The board is a growing history, not a dashboard that resets. The owner can scroll back to any past phase and see exactly what happened.
- **Every card preserves its break-it findings.** Each card carries the plain-English results of the adversarial passes that gate that phase. Because the owner delegates deep review to those findings (see `03`), **the findings on this board *are* his review record** — they must stay, verbatim in spirit, forever.

### The card shape (what each phase card holds)

The board is driven by a `PHASES` array in the page; each entry is one card:

| Field | Meaning |
|-------|---------|
| `id` | Stable key for the card — never reused, never changed. |
| `title` | The phase name, e.g. "Phase B · Merge tool". |
| `status` | `done` / `active` / `queued` — drives the badge + border color. |
| `desc` | One plain-English line: what this phase gives the owner. |
| `note` | The current standing — e.g. "Shipped & verified on the owner's iPhone (123 tests)". |
| `steps[]` | The workflow checklist for the phase — each `{n: name, s: state}` where state is `done` / `active` / `queued`, rendered as ✓ / ◐ / ◦ chips (Design approved · Break the spec · Plan · Break the plan · Build · Break the build ×2 · Live verify). |
| `breaks[]` | The adversarial record — a list of `{stage, verdict, items[]}`. `stage` = which gate ("🛡️ Break the SPEC"), `verdict` = the one-line outcome ("2 fixed"), `items` = the plain-English findings. An optional `link` may point to a full write-up (not every board wires it up). |

The page renders all of this from the array — add a phase by appending one object; update a live phase by editing only its own fields. That mechanical rule is what keeps the history honest. A ready-to-copy starter is `templates/progress-board.html` — note it's an intentionally **self-contained** variant (its tokens are inlined and it follows the OS light/dark preference with no separate toggle), so it works on its own before you've wired in the shared `tokens.css`/theme toggle the other hub pages use.

> Recording break-it findings here is **step 3 of "after every pass"** in `03-stress-tests.md`. The stress tests produce the findings; this board is where they live for good.

---

## Publishing + verifying (the ops that bite)

Publishing is "push to the default branch." The trap is assuming *pushed = live*. **GitHub Pages rebuilds on a lag of roughly 1–2 minutes**, and until it finishes, the old content is what the URL serves — worse, **a brand-new file or sub-folder returns 404** until the rebuild indexes it. If you tell the owner "it's live" the instant you push, he may open a 404 or a stale page and lose trust in the board.

**The rule: don't announce a page as live until you've confirmed it with your own eyes (via a fetch), not the git push.**

The polling technique, in words:

1. Push to the default branch.
2. **Fetch the actual URL** (not the local file) and check the response — for a brand-new page, that it isn't a 404; for an update, that a **specific new string** you just added is present in the returned HTML.
3. If it's still stale or 404, **wait ~20–30 seconds and fetch again.** Repeat a few times — Pages usually settles inside 1–2 minutes.
4. **Only once the new content actually shows** do you give the owner the URL and say it's ready.

This is a live-verify of the *page itself*, in the same spirit as live-verifying the app on the real device.

## Hosting-deploy verification (the app, not the hub)

The same "push ≠ done" trap applies to the **app's own host** (for Shelfie, Vercel). A `git push` *usually* triggers the host to build and deploy — but not always, and a push that deploys the code is not proof the deploy **succeeded**. So after any push that should ship the app:

- **Confirm the deploy actually reached "Ready"** on the host — check the deployment status, don't infer it from the push.
- **If the build didn't fire, or it failed, force a fresh deploy** from current source rather than reusing a stale prior build.
- Only then treat the live app as updated.

The exact commands (how to list deployments, how to force one, the Windows secret-handling gotchas) live in the **project's own docs**, because they're host- and OS-specific — this Playbook just fixes the *pattern*: **verify the deploy reached Ready; if it didn't fire, force it.**

---

## The design system the hub carries

Every hub page pulls the same two shared files, so the hub is visually one product — and doubles as a **live sample of the app's look**. Pick your *own* palette and fonts (this is a pattern to copy, not a mandate); the two files are:

- **A tokens stylesheet** (`templates/tokens.css` is the generic starter) — the design tokens as CSS variables: surfaces, text, lines, an accent + the semantic green/amber/red, radius, shadows, and a **display / body / mono** font-role split. Light **and** dark values are both defined as variable sets. *(Shelfie's was a "fresh market receipt" palette — warm paper / charcoal-green — with Fraunces · Hanken Grotesk · Spline Sans Mono; that's the worked example, not a requirement.)*
- **A theme script** + a tiny inline `<head>` snippet — a **persistent light/dark toggle with no flash of the wrong theme**. The head snippet reads the saved choice (or the OS preference) and stamps `data-theme` on the root element *before the page paints*, so there's no flash; the script then wires the floating 🌙/☀️ button to flip and remember the choice in `localStorage`. (See `templates/hub-index.html` for both wired up.)

Because the hub renders in the app's real tokens and fonts, the owner reviewing the board is also, quietly, reviewing the app's taste. The mockup and full design detail live in `06-mockups-and-illustration.md`.

---

## How the owner actually reviews (the walkthrough)

Put together, one review round looks like this:

1. **You publish** the relevant page (mockup, spec, review, or the updated progress board) to `/docs` and push.
2. **You poll the URL** until the new content actually shows (per the lag rule above).
3. **You send the owner two things in chat:** the live URL, and a **multiple-choice question** — e.g. *"Mockup's up: [link]. Go with (A) the two-tab layout, (B) three tabs, or (C) something else?"*
4. **He opens the link on his phone**, clicks around / reads the findings, and **replies with a letter.**
5. **His answer is the approval** — recorded, folded in, and the next gate begins.

That loop — publish, verify-it's-live, ask a tappable question, get a letter back — is how a remote owner stays fully in control of a build he never sees the code of.


---

# 06 — Mockups & illustration (see it before you build it)

The workflow (`02-workflow.md`) puts a visual step **between brainstorm and code**: once a design is agreed in words, you make it *visible* before writing any product code. This file is how that's done — the clickable mockup, the shared design system, and the odd diagram.

The one-line rule: **the owner should be able to click the app before it exists.**

## Why mock up before you code

Words hide disagreement. "A clean dashboard with the budget at the top" sounds agreed — until two people picture two different screens. A picture you can tap collapses that ambiguity to zero.

- **It de-risks the build.** The look and the navigation are settled *before* a line of product code exists, so you don't discover on day three that the whole layout is wrong.
- **A remote owner can actually judge it.** The mockup is published to the hub (see `05-hub-and-review.md`) as a real web page. The owner clicks through it on their phone and reacts to the true thing, not a description.
- **It's cheap to throw away.** A mockup is fake data and static screens — changing it costs minutes. Changing a built feature costs a rebuild.
- **It doubles as a living taste of the app.** Long after approval, the mockup stays on the hub as the reference for "this is what we agreed it should feel like."

This is a hard gate for anything with a new look or a new flow: **no UI code until there's an agreed visual.**

## What a good mockup includes

Not a wireframe of grey boxes — a believable slice of the real app:

1. **The real screens/tabs.** Every top-level view the feature touches, reachable from a real nav bar — not one hero screen in isolation.
2. **Fake but realistic data.** Real-looking store names, prices, dates, categories. Realistic data exposes layout problems (long names, big numbers, empty states) that "Lorem ipsum" hides.
3. **The key flows, tapped end-to-end.** The owner can actually walk the main journey — open a receipt, add an item, switch a month — and hit the toasts and confirmations along the way.
4. **The *real* styling.** Same fonts, colours, radius, shadow, spacing as the shipped app will use. The owner is judging the true look, so the mockup must *be* the true look — see the design system below.

Shelfie's mockup (`docs/mockup.html`) is a single self-contained HTML file: an iPhone frame with a lock screen, a bottom tab bar, a sliding receipt sheet, working light/dark toggle, and fake pantry data — all clickable, all on the hub. It was signed off before the first real component was written.

## The design system (define the look once, share it everywhere)

The mockup, the hub, and the real app must look identical. That only works if they draw from **one set of design tokens** — CSS variables defined once and copied into each surface. Change a token, and every surface moves together.

**This is a pattern to copy, not a mandate.** Pick your own palette and fonts — but structure them the same way. Here's Shelfie's set as a worked example.

### Token categories

Group the variables by role so the vocabulary is shared across the whole app:

| Category | Role | Shelfie tokens |
|----------|------|----------------|
| **Paper** | Page backgrounds | `--paper`, `--paper-2` |
| **Card** | Raised surfaces | `--card`, `--card-2` |
| **Ink** | Text, three weights | `--ink`, `--ink-soft`, `--ink-faint` |
| **Line** | Borders, dividers | `--line`, `--line-soft` |
| **Accent** | The brand colour | `--green`, `--green-strong`, `--green-soft` |
| **Semantic** | Status meaning | `--green` (good) · `--amber` (warn) · `--red` (over) — each with a `-soft` background |
| **Form / shape** | Fonts, radius, shadow | `--font-display`, `--font-body`, `--font-mono`, `--radius`, `--shadow` |

### The font-role split

Three fonts, each with one job — never mix them up:

- **Display serif** (`--font-display`: Fraunces) — headings and the app title. Gives character.
- **Body grotesk** (`--font-body`: Hanken Grotesk) — all running text, labels, buttons. Gives clarity.
- **Mono numerals** (`--font-mono`: Spline Sans Mono, with `font-variant-numeric: tabular-nums`) — prices and amounts, so columns of numbers line up.

### Light + dark, done properly

Two things are easy to get wrong. Both matter:

- **Theme via a `data-theme` attribute.** `:root` holds the light tokens; `:root[data-theme="dark"]` overrides them. Components never hard-code a colour — they only read tokens, so both themes come for free.
- **No-flash init — set the theme *before first paint*.** A tiny inline script in `<head>`, running before the body renders, reads the saved theme and stamps `data-theme` on `<html>`. Without it, the page flashes light then snaps to dark — ugly and amateur. Shelfie's one-liner:

  ```html
  <script>(function(){try{var t=localStorage.getItem('shelfie-theme');
    if(!t)t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
    document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
  ```

- **A persistent toggle.** A single control writes the choice to `localStorage` and flips the attribute; the init script reads it back next load. Default to the OS preference when nothing is saved.

## Pick a distinctive aesthetic — and commit to it

The biggest trap is the **generic AI default**: the flat blue-and-white, system-font, rounded-rectangle look that every unopinionated app wears. It's forgettable.

Instead, choose a **real design direction** with a name you can point back to, and apply it consistently. Shelfie's is **"fresh market receipt"** — warm paper backgrounds, a deep charcoal-green accent, a serif display face, a faint paper-grain texture, dashed "perforation" dividers like a till receipt. Every screen honours it. The direction is a decision you can defend, not a default you fell into.

One clear aesthetic, applied everywhere, beats three tasteful ones fighting each other.

## Illustration & diagrams

When a flow or an architecture is easier *seen* than read, draw it — but keep it honest and minimal. A diagram earns its place by explaining something; it never decorates.

- **In docs:** a simple ASCII flow (like the one in `README.md`) travels anywhere, diffs cleanly in git, and needs no tooling.
- **On the hub:** an SVG or a mermaid diagram when the shape genuinely helps — a state machine, a data pipeline, a screen-to-screen flow.
- **The test:** if the diagram says something the surrounding sentence already says, delete it. If it replaces a paragraph you'd otherwise struggle to write, keep it. Match the real system exactly — a diagram that's subtly wrong is worse than none.

## The consistency rule (mockup → hub → product)

The mockup's tokens **become** the app's tokens. This isn't a coincidence to hope for — it's a rule you enforce by sharing the actual variables.

On Shelfie, `docs/shelfie.css` defines the system; `docs/mockup.html` uses it; the hub pages use it; and `app/globals.css` is the *same tokens ported into the real app* (its header literally says "Ported from docs/shelfie.css", with the fonts wired to `next/font`). The values are identical — same hexes, same radius, same shadow — so the shipped app matches the thing the owner approved, pixel for pixel.

When you touch a colour, change it in the token source, and let every surface inherit it. Never let the app and the mockup drift apart.

## Checklist — before building any UI feature

- [ ] Is there an agreed **mockup or visual** for this screen/flow?
- [ ] Does it use **fake but realistic data**, not grey boxes?
- [ ] Is it styled with the **real design tokens** (so the owner judges the true look)?
- [ ] Is it **published to the hub** so the remote owner can click it?
- [ ] Has the owner **signed off** on look *and* navigation before any product code?
- [ ] Do light **and** dark both render, with **no theme flash** on load?
- [ ] Will the built feature draw from the **same tokens** the mockup used?

If any box is unchecked, you're about to code a look nobody has approved. Stop and mock it up first.


---

# 07 — Scope & bundles (defining and slicing the work)

Scope decides what you build; bundles decide the order you build it in. Get both wrong and you build the right thing in an unshippable heap, or the wrong thing beautifully. This file is how the work gets shaped before `02-workflow.md` runs on each piece.

## 1. Define scope as outcomes, not tasks

Write scope as **what the product lets the user DO** — the moments that matter — not a task list. Tasks are how; outcomes are why. "User can snap a receipt and see the total land in this month's budget" is an outcome. "Build PDF parser" is a task that only earns its place if it serves one.

**The cut list matters as much as the feature list.** For every project, write down — explicitly, in the spec — what it will **NOT** do. A deliberately-cut list is a decision you can point back to when scope creep knocks. It stops "wouldn't it also be nice if…" from quietly becoming work.

> **Shelfie in spirit:** Shelfie's whole premise was a *simpler rebuild* — an earlier tool had been over-built with features that were rarely used and hard to maintain. The rebuild's first real act of design was deciding what to **drop**: most of the predecessor's surface area was cut on purpose, leaving a single-user grocery price + budget tracker that did a few things well. The cut list *was* the product vision.

**YAGNI is a scoping tool, not just a coding one.** "You Aren't Gonna Need It" applied at scope time kills whole features before they cost a spec, a plan, and a build. The cheapest feature to maintain is the one you never agreed to.

## 2. Slice into bundles (shippable, testable units)

A **bundle** (or phase) is a slice of scope you can actually ship and check. Rules for a good bundle:

- **Shippable** — it produces something real the owner can use or see, not a half-wired internal.
- **Testable** — it has a clear way to prove it works (tests + a live run).
- **~1–4 sessions** to complete. Bigger than that, split it.
- **Doesn't break the last one** — each bundle builds on the previous without regressing it.
- **A clear "done" definition** agreed up front (see §6).
- **3–10 milestones**, each one clear, verifiable task.

Small enough to finish and prove; big enough to be worth shipping. If you can't say in one sentence what a bundle lets the owner do that they couldn't before, it isn't a bundle yet.

## 3. Milestone states (surfaced on the board)

Each milestone carries one of three states, shown live on the hub board (`05-hub-and-review.md`) so the owner always sees true progress:

| Icon | State | Means |
|------|-------|-------|
| ✅ | complete | Done and verified — not "code written", but proven. |
| 🟡 | in progress | Started, not finished — note what remains. |
| ❌ | not started | Not begun (or blocked — say which). |

The board is append-only and honest: a milestone only flips to ✅ when there's evidence, per `01-rules.md` §7.

## 4. Lock the bundle sequence

Once the order of bundles is agreed, **treat it as fixed.** You don't reorder, merge, or skip bundles on your own — that's a locked-decision / decision-authority event (`01-rules.md` §3 and §5). Changing the sequence means: surface it → get explicit owner approval → update the record.

**Record the sequence where it can't be missed** — the project registry / handover, and the hub board. A locked sequence written only in your head is not locked. Example shape:

```
Bundle sequence (LOCKED):  Core ✅ → Receipt import ✅ → Polish A ✅ → Polish B → Polish C/D
```

The `✅` markers on the sequence itself let anyone read the state of the whole roadmap at a glance.

## 5. Decompose big scope into sub-projects

If a request spans **several independent subsystems**, don't force it into one spec — it will be too big to break-test and too tangled to build. Instead, break it into **sub-projects**, each getting its own **spec → plan → build** cycle (the full flow in `README.md`).

When you decompose, state three things plainly:

1. **What the independent pieces are** — the natural seams (e.g. "the scanner", "the merge tool", "the sync layer").
2. **How they relate** — what depends on what, what shares data, what's genuinely standalone.
3. **What order to build them in** — and why that order (usually: foundation first, then the pieces that lean on it, feasibility-risky pieces gated behind a spike).

Each sub-project then runs the normal bundle slicing inside itself. A subsystem that might not be feasible gets a small proof/spike *before* it earns a place in the locked sequence.

## 6. Definition of done (per bundle)

A bundle is **done** only when all of these are true — not when the code compiles:

- [ ] **Shippable** — the slice does what it promised end-to-end.
- [ ] **Verified on the real device** — the owner ran it on the device of record (`01-rules.md` §8), not just the dev machine.
- [ ] **Tests green** — the suite passes; new logic has tests (`02-workflow.md` ④).
- [ ] **Docs + board updated** — milestones flipped to ✅ with evidence; docs reflect reality (`04-documentation.md`).
- [ ] **All four gates cleared** — break-spec, break-plan, break-build ×2, live run (`README.md`).

"Done" is a bar, not a feeling. If any box is empty, the bundle is 🟡, not ✅.

## 7. Scope changes are a decision-authority event

Per `01-rules.md` §3, none of these are done on your own initiative — **ask first, never assume:**

- Adding a **new feature** to a bundle's scope.
- An **architecture change** that alters how bundles fit together.
- **Removing** a feature that was in scope.
- Anything that adds **cost** (a new tool/service) or moves the **timeline**.
- **Reordering or merging** locked bundles.

Small bug fixes, refactors, tests, and docs inside an agreed bundle are yours to do automatically. The line is: *does this change what we agreed to build, or just how well we build it?* Changing the *what* needs a yes.

## 8. Worked example — Shelfie's phase roadmap

Shelfie ran as a locked roadmap, each phase shipped and live-verified before the next began:

| Phase | Outcome it delivered | Gate before moving on |
|-------|----------------------|-----------------------|
| **Core** | Track items, prices, and a monthly budget by hand. | Shipped + verified on iPhone. |
| **Receipt import** | Snap/import a receipt → items + total flow into the budget. | Shipped + verified. |
| **Polish A** | Show barcode on an item. | Shipped + verified. |
| **Polish B** | Merge duplicate items into one. | (in sequence) |
| **Polish C / D** | Barcode scanning — **feasibility-gated** behind a spike. | Only enters the sequence if the spike proves it works. |

Two things this example shows:

- **One at a time, proven each time.** No phase started before the previous one was live-verified and its board turned ✅. This is build cadence (`01-rules.md` §4) applied at the roadmap level.
- **Extras slot in *with approval* and still run the full gate flow.** A small feature the owner asks for mid-roadmap can be added — but it's a scope change (§7): agree it, place it in the sequence, then it earns the *same* spec → break → plan → break → build → break ×2 → live-verify treatment as everything else. No feature skips the gates because it's "small."

## 9. Scoping checklist for a new project

Before slicing any bundles, pin these down with the owner:

- [ ] **The one-line pitch** — what this is, in a sentence. (Shelfie: "a single-user grocery price + budget tracker.")
- [ ] **The must-do user moments** — the 3–7 things the user must be able to DO. These become your outcomes.
- [ ] **The explicit cut list** — what it deliberately will NOT do, written down.
- [ ] **The bundle sequence** — the ordered, locked list of shippable slices, recorded where it can't be missed.
- [ ] **The "done" bar** — what "done" means for this project (device of record, gates, docs), so no bundle closes on vibes.

Get these five on paper and the rest of the Playbook has something real to run against.


---

# 08 — The bootstrap checklist (cold start any project)

This is the "day one" runbook: how to put **any** project onto this system from a cold start. Two starting tracks — **A. brand-new** and **B. existing/retrofit** — that merge into **C. the per-feature flow** everyone follows from then on.

> **Why two tracks:** a new project defines its scope and look before there's any code; an existing one has to first *capture the truth of what's already there* before it can be steered the same way. Once both have a live hub and a known scope, they run identically.

Use the checkboxes literally — tick each as you go. Shelfie is the running example; swap in your own project's specifics.

---

## A. Brand-new project

- [ ] **Copy the `PLAYBOOK/` folder into the repo.** It travels with the project; the whole method comes with it.
- [ ] **Write the one-line pitch + must-do moments + the cut list.** One sentence on what it is, the handful of user moments it absolutely must nail, and an explicit **"not doing"** list. Cutting loudly on day one is what keeps a "simple" project simple (see `07-scope-and-bundles.md`). *Shelfie: "a single-user grocery price + budget tracker" · must-do: snap a receipt → see prices → track the month · cut: multi-user, sync, accounts.*
- [ ] **Record the project's rules specifics** as a short registry/handover entry: model policy, currency/units, **device of record**, hosting/runtime, and where secrets live (see `01-rules.md` and `04-documentation.md`). *Shelfie: all-Opus · AED · iPhone incl. installed home-screen app · web host, secrets in the host dashboard only.*
- [ ] **Set up the hub.** A `docs/` folder served by GitHub Pages, using the shared design tokens/CSS with a light/dark toggle; a front-door `index.html` and a live `progress.html` board (see `05-hub-and-review.md` and `06-mockups-and-illustration.md`).
- [ ] **Build the clickable mockup with fake data, publish it, get the look + flow approved** before any real code (see `06-mockups-and-illustration.md`). Approval is in a browser, not a description.
- [ ] **Lock the bundle sequence** — the ordered list of shippable slices, core happy-path first (see `07-scope-and-bundles.md`). Locked means it doesn't get reordered without the owner's OK.
- [ ] → Go to **C**.

---

## B. Existing project (retrofit)

- [ ] **Copy the `PLAYBOOK/` folder into the repo.**
- [ ] **Write a handover that captures the current true state** — what actually works today (not what was planned), a repo map (where things live), and any already-solved gotchas/lessons so they're never re-learned the hard way (see `04-documentation.md`). Be honest: half-done is "half-done," not "done."
- [ ] **Stand up the hub + a `progress.html` board that reflects what's already shipped** — render the completed work as **done cards** so the owner immediately has the live view of reality (see `05-hub-and-review.md`).
- [ ] **Backfill the scope:** write the pitch, the cut list, and the **remaining** bundle sequence for everything still ahead (see `07-scope-and-bundles.md`).
- [ ] **Record the rules specifics** (model policy, currency/units, device of record, hosting, secrets location) just like a new project — even if you're inferring them from the existing code.
- [ ] From here, **treat every further change with the full flow** — no more ad-hoc edits. → Go to **C**.

---

## C. The per-feature flow (both tracks, every feature from now on)

Run this loop for each feature or bundle. Scale the ceremony to the size of the change (a one-line fix still gets a root-cause and a verification; a user-facing feature gets all four gates). Full detail: `02-workflow.md` and `03-stress-tests.md`.

- [ ] **Brainstorm → agreed design.** One question at a time, YAGNI hard, propose 2–3 options with a recommendation. **No code yet.**
- [ ] **Spec → break-spec → fold in.** Write the design down (`docs/superpowers/specs/YYYY-MM-DD-<topic>.md`), then a fresh skeptic attacks the *design* for holes; fix or explicitly de-scope every finding.
- [ ] **Plan → break-plan → fold in.** Bite-sized, test-first tasks with exact paths and complete code (`plans/…`), then a fresh skeptic attacks the *plan* (fixtures, ordering, signatures, gotchas); fold findings in.
- [ ] **Build.** One fresh subagent per task, strict TDD (failing test → pass → commit), commit frequently.
- [ ] **Break-build ×2 + confirm → fold in → re-run checks.** Two independent skeptics with different lenses (correctness // real-use-on-device), then a short confirm pass on the fixes. Re-run tests / typecheck / build so the fixes are proven, not assumed.
- [ ] **Publish to the hub; verify the deploy reached Ready.** Push after each meaningful step; don't assume push = deployed — confirm Pages/host went live (see `05-hub-and-review.md`).
- [ ] **Owner live-verifies on the real device.** Give a short numbered "tap this, expect that" checklist; the owner exercises the actual flow on the device of record and signs off. A finding here is normal — it's the last gate for a reason.
- [ ] **Update the board + docs, live.** Append-only, preserve every break-it finding; the record stays current as work happens, not at the end (see `04-documentation.md`).

> **The four gates — break-spec, break-plan, break-build ×2, live-verify — are the default, not the exception.** A bug can survive three and die at the fourth; that's the whole point.

---

## The session-start ritual

Before writing any code in a fresh session, orient yourself so you never build on a stale picture:

1. **Read the handover** (current true state), the **latest project state**, and the **last session log**.
2. **State it back:** the active project, the active bundle, the open milestones, and the proposed next 1–3 tasks.
3. **Wait for the owner's confirmation** before touching code. If anything is unclear, ask — never assume.

## The session-end ritual

Before closing a session, leave the record honest and the next session set up:

1. **Run the project's verification checklist** (the concrete "does it still work" list for this project).
2. **Update the board + docs** to reflect exactly what happened, findings preserved.
3. **Write a session log** (`sessions/YYYY-MM-DD_session-N_short-title.md`) — what was done, files touched, decisions, blockers, next 3 tasks. A cold session must be able to resume from it alone.
4. **Give a 3-bullet status:** what was done · what's next · any blockers. Use ✅ / 🟡 / ❌ in the summary, plain English in the prose.

---

## What good looks like

When this is running right, **bugs die at the design stage** — killed by a skeptic reading a spec, long before they cost a debugging session. **The owner sees everything as web pages** — the mockup, the progress board, every break-it finding — and approves in a browser, never from a promise. **The app is proven on the real device**, not just in a passing test suite. And **the record is always live and honest**: the board and docs show the true state at every moment, findings preserved append-only, so anyone — the owner today, a cold session tomorrow — can trust exactly what they read. Slow-looking, fast-in-truth.


---

# templates/ — copy-paste starters

Fill-in starters for every artifact in the Playbook workflow. Each is generic and
project-agnostic — copy one, replace the `«placeholders»`, delete the guidance
comments. (Shelfie appears only as the occasional worked example.)

## The files

| File | What it is | When to use it |
|------|-----------|----------------|
| `spec-template.md` | A design spec: motivation, current behavior to preserve, new behavior, architecture, edge cases, testing, non-goals, success criteria, and a break-spec findings table. | At the **② SPEC** stage, right after brainstorming and before any planning. This is the artifact the first break-it pass attacks. |
| `plan-template.md` | An implementation plan in bite-sized TDD tasks — each with Files, numbered steps (failing test → confirm fail → minimal code → confirm pass → commit), exact commands + expected output, a self-review checklist, and an owner verification checklist. | At the **③ PLAN** stage, once the spec is broken-and-fixed. Hand it to a builder (one fresh subagent per task). |
| `break-it-prompts.md` | The four consolidated skeptic prompts — Break the SPEC, Break the PLAN, Break the BUILD ×2, and the Confirm pass — with fill-ins and a "how to run it" note. | At **every 🛡 gate**. Paste the matching prompt to a fresh reviewer; fold findings in; record them on the board. |
| `session-summary-template.md` | An end-of-session log: goal, what was done (✅/🟡/❌), files created/modified, bundle status, blockers, next 3 tasks, usage, and a cold-start handoff paragraph. | At **session end**, every time. Keeps the trail so a fresh session can resume. |
| `handover-template.md` | A cold-start orientation doc: 30-second summary, the rules, stack & architecture, what's DONE, repo map, the pending item, environment gotchas, and a troubleshooting playbook. | Once per project, kept **live**. The first thing a brand-new session reads. |
| `progress-board.html` | A self-contained, dependency-free live board (auto-refresh, OS light/dark, per-phase cards driven by a `PHASES` array). Preserves every break-it finding, append-only. | Stand up **once at project start**; update as work happens. This is what the remote owner reviews in a browser. |
| `hub-index.html` | The hub **front door** — a card grid linking to the mockup / spec / review / progress board / live app, with a no-flash theme init + toggle, wired to `tokens.css`. | Stand up **once at project start**, alongside the board. The lobby the owner lands on. |
| `tokens.css` | The shared **design-token** stylesheet (surfaces, text, accent + semantics, radius, shadow, font-role split) in light + dark. The single source of look for mockup → hub → app. | Copy in **at the start**, swap the palette/fonts for your project's direction (see `../06-mockups-and-illustration.md`). |

> **Note on this folder vs the spec.** The playbook spec (§4) originally listed the three break-it prompts as separate files and named `progress.html`/`hub.css`; they were intentionally consolidated into `break-it-prompts.md` and renamed to `progress-board.html`/`tokens.css`. Two doc types from `../04-documentation.md` (the **master doc** and the **bundle/build log**) ship no starter on purpose — they're freeform running documents, not fill-in forms.

## How they fit the flow

```
brainstorm → spec-template → 🛡 break-it-prompts (SPEC) → plan-template
   → 🛡 break-it-prompts (PLAN) → build → 🛡 break-it-prompts (BUILD ×2 + confirm)
   → live-verify
```

The **progress-board** and **handover** stay live the whole way; a
**session-summary** closes each working session. See `../README.md` for the full
philosophy and `../08-bootstrap-checklist.md` to stand a new project up on this
system.


---

