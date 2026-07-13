# «Feature name» — Implementation Plan

> **For agentic workers:** «REQUIRED SUB-SKILL: one fresh subagent per task (e.g.
> superpowers:subagent-driven-development) or execute-the-plan. Steps use checkbox
> (`- [ ]`) syntax for tracking.» **«MODEL, e.g. ALL OPUS.»**

**Goal:** «one sentence — what a competent, context-free engineer will have built
when this plan is done.»

**Architecture:** «2–4 sentences — the new files/components, the one or two tricky
mechanisms, and the explicit "no server/action/schema/data changes" boundary if it
applies. Enough that a reviewer can sanity-check the shape before reading tasks.»

**Tech Stack:** «framework + version, key libraries, test runner, styling approach.»

**Spec:** `«path/to/spec.md»` (read it — all «N» break-spec findings are folded into
the requirements below).

---

## File structure

«Every file the plan touches, CREATE vs MODIFY, one line each. This is the map the
break-plan reviewer checks against the real repo.»

- **Create** `«path»` — «what it is. Note client/server safety if relevant.»
- **Create** `«tests/path.test.ts»` — «unit tests for the new pure logic.»
- **Modify** `«path»` — «what changes; what stays.»
- **No other files.** Do NOT touch «the layers the spec promised are unchanged».

---

## Task 1: «short name of the first bite-sized unit» (TDD)

«Each task is small, shippable, and committed on its own. Pure logic is written
test-first: failing test → confirm it fails → minimal code → confirm it passes →
commit. Presentation-only tasks skip the test but still typecheck + build + commit.»

**Files:**
- Create: `«lib/thing.ts»`
- Test: `«tests/thing.test.ts»`

- [ ] **Step 1: Write the failing test**

```ts
// «tests/thing.test.ts»
«full test code — real cases, not stubs. Cover the spec's edge cases here.»
```

- [ ] **Step 2: Run test to verify it fails**

Run: `«exact command, e.g. cmd /c "npx vitest run tests/thing.test.ts"»`
Expected: FAIL — «the specific reason, e.g. cannot resolve @/lib/thing».

- [ ] **Step 3: Write minimal implementation**

```ts
// «lib/thing.ts»
«the smallest code that makes the test pass — no speculative extras (YAGNI).»
```

- [ ] **Step 4: Run test to verify it passes**

Run: `«exact command»`
Expected: PASS («N» tests).

- [ ] **Step 5: Commit**

```bash
«git» add «lib/thing.ts tests/thing.test.ts»
«git» commit -F <msgfile>   # msg: "«type(scope): concise message»"
```

---

## Task 2: «next unit — e.g. the component / the wiring»

«For a presentation/refactor task with no new pure logic, say so plainly and do
NOT invent a hollow test. The steps become: write the code → typecheck → build →
commit. Still one commit, still verifiable.»

**Files:**
- Create / Modify: `«path»`

- [ ] **Step 1: Write the «component / change»**

```tsx
// «path»
«full code — no "// ... rest unchanged" gaps; the builder pastes this.»
```

- [ ] **Step 2: Typecheck + build**

Run: `«cmd /c "npm run typecheck"»` then `«cmd /c "npm run build"»`
Expected: both clean. «Note any temporarily-unused symbol that's fine because a
later task consumes it.»

- [ ] **Step 3: «Full suite, if this task completes the feature»**

Run: `«cmd /c "npm test"»`
Expected: **«N» passed** («prior» + «new»).

- [ ] **Step 4: Commit**

```bash
«git» add «path»
«git» commit -F <msgfile>   # msg: "«type(scope): message»"
```

---

## Task «N»: Deploy + verify Ready

- [ ] **Step 1: Push**

```bash
«git» push origin «main»
```

- [ ] **Step 2: Confirm the deploy fires + reaches Ready**

Run: `«deploy-status command»` — expect a fresh Building/Ready row for the new
commit. If none within ~2 min: `«force-deploy command»`. Then confirm production
serves the new build.

- [ ] **Step 3: Hand off for the owner's live verify** (checklist below).

---

## Verification checklist (owner, on «the real device»)

«Numbered, plain-English, tap-by-tap. Each line is something the owner can DO and
SEE. Cover the happy path, the destructive path (with its confirm gate), and the
device-specific cases the spec called out (keyboard, safe areas, dark mode).»

1. «step → expected result»
2. «...»
3. No console errors; «no stuck state after closing / navigating».

---

## Self-review (author)

- **Spec coverage:** «map each spec section (§3.1, §3.2, …) to the task that
  implements it. Confirm every requirement — including every folded-in break-spec
  finding — has a home. Note anything intentionally deferred.»
- **Placeholder scan:** «"none — every step has full code" (there must be no
  `// ...` gaps, no TODO, no pseudo-code left).»
- **Type consistency:** «the new types match how they're consumed; shared shapes
  are identical across files; called action/API signatures are unchanged.»
- **Note for the builder:** «any gotcha — a platform-support assumption, a "keep
  these calls byte-for-byte identical" warning, a "do not add library X" steer.»

---

## Break-plan pass — findings folded in («YYYY-MM-DD»)

«After a fresh reviewer attacks this plan (templates/break-it-prompts.md → Break
the PLAN), record findings and where each was folded in. Then re-run the checks.»

| # | Sev | Finding | Where folded |
|---|-----|---------|--------------|
| 1 | «Major» | «e.g. task ordering means an early commit won't compile» | «resequenced Task 2↔3» |
| 2 | «Minor» | «...» | «...» |

**Verdict after fold-in:** «"ready to execute" | "needs rework".»
