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
