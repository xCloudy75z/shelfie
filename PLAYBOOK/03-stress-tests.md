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
