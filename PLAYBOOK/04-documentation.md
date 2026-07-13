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
