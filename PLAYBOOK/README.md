# The Playbook — a portable way of working

> The exact system used to build **Shelfie** (a single-user grocery price + budget tracker), packaged so **any project — old or new — can be run the same way.** Shelfie is the worked example throughout; the method is project-agnostic.

This folder is meant to be **copied into a project** (or kept as a reference beside it). Read `README.md` first, then the numbered files in order. The `templates/` folder holds copy-paste starters.

**Canonical source:** the master of this kit lives in the private repo **`github.com/xCloudy75z/the-playbook`** — adopt / audit / rebuild / sync a project via that repo's `ADOPT.md`, and pull method updates from there.

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
