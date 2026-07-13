# The Way-of-Working Playbook — design spec

**Date:** 2026-07-13
**Status:** Approved to build now (Shelfie is feature-complete; owner wants it as the capstone deliverable).
**Goal:** A **portable, project-agnostic package** that captures the *exact* system used to build Shelfie, so the owner can run every project — old and new — the same way. Shelfie is the worked reference example.

---

## 1. Why

Shelfie was the owner's first project and the way it was built — superpowers workflow, adversarial "break-it" stress tests at every artifact, a remote-owner HTML hub, live device verification, continuously-updated docs — is what made it "fabulous." He wants that method **templatized and reusable** across all his projects, not locked inside Shelfie's head.

## 2. What it must cover (owner's list, expanded)

Every rule & instruction · the full way of working · how scope-of-work is defined · how documentation happens · how illustration/diagrams happen · how mockups get built · how a **remote owner reviews HTML files in the hub** · the **superpowers** workflow · the adversarial **stress tests** · live-verify · keeping docs/hub live — *everything*.

## 3. Form & location

- **Portable folder:** `PLAYBOOK/` at a project root — plain markdown + a `templates/` subfolder of copy-paste starters. Self-contained so it can be copied into any repo.
- **Readable hub page:** `docs/playbook.html` (rendered, styled with the existing hub CSS) linked from the hub front door, so the owner reviews it as a real web page.
- **Project-agnostic voice:** describe the *method*; use Shelfie only as the illustrative example. No hard-coded Shelfie-only assumptions (paths, ports) except as examples.

## 4. Structure (the package)

`PLAYBOOK/`
- `README.md` — **The Operating System**: the philosophy + the end-to-end flow diagram (brainstorm → spec → break-spec → plan → break-plan → build (subagent TDD) → break-build ×2 + confirm → live-verify → keep docs live), and how to use this folder.
- `01-rules.md` — the non-negotiables: model policy, privacy, decision authority, build cadence, communication style, destructive-action confirms, the device/testing model, locked-decision discipline.
- `02-workflow.md` — each stage in detail: what it is, who does it (fresh subagent per task), inputs/outputs, the "no code before approved design" gate, TDD, subagent-driven development.
- `03-stress-tests.md` — **the secret sauce**: how break-spec / break-plan / break-build ×2 / confirm-pass work, why two independent build passes, *with ready-to-paste skeptic prompt templates*.
- `04-documentation.md` — the doc system: spec, plan, handover, master doc, session log, bundle log — where each lives, when it updates ("keep docs live"), and the rule that findings are preserved append-only.
- `05-hub-and-review.md` — the GitHub Pages hub: pages (index/mockup/spec/review/progress/masterdoc), the append-only per-phase progress board, how a remote owner reviews via HTML, publish + verify-Pages steps, and how in-chat multiple-choice is used for decisions.
- `06-mockups-and-illustration.md` — build a clickable HTML mockup *before* code to lock look & flow; the design-system approach (tokens, fonts, light/dark); when/how to use diagrams and visuals.
- `07-scope-and-bundles.md` — how scope-of-work is defined and sliced: bundles/phases, "done" definitions, milestone states, locked bundle sequences.
- `08-bootstrap-checklist.md` — step-by-step to put any project (old or new) onto this system from a cold start.
- `templates/` — copy-paste starters: `spec-template.md`, `plan-template.md`, `progress.html`, `hub-index.html` + `hub.css` pointer, `break-spec-prompt.md`, `break-plan-prompt.md`, `break-build-prompt.md`, `session-summary-template.md`, `handover-template.md`.

## 5. Quality bar

- No placeholders, no TBDs. Every prompt template is complete and copy-pasteable.
- Each section scannable: plain English first, the *why* before the *what*.
- After drafting, a fresh Opus **completeness-critic** pass verifies every item in §2 is covered with a concrete home, and flags anything missing or vague. Fold findings in before publishing.

## 6. Out of scope

- Not a rewrite of the global `xCloudy/CLAUDE.md` (the playbook complements it; it can reference it).
- Not Shelfie-specific runbooks (those stay in Shelfie's own docs).

## 7. Done when

The `PLAYBOOK/` folder exists with all sections + templates filled, the hub `playbook.html` renders it and is linked from the hub, the completeness-critic pass is green, and the owner has the URL.
