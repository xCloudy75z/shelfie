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
