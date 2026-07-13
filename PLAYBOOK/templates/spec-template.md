# «Feature name» — design spec

**Date:** «YYYY-MM-DD»
**Status:** «Design approved (owner, in chat) → break-spec next | in break-spec | approved to plan»
**Scope:** «one line — exactly what this touches, and the hard boundary of what it does NOT touch. e.g. "Month tab only. No server, action, schema, or data-model changes."»

> Write the design down BEFORE any code. This is the artifact the first break-it
> pass attacks. Every «placeholder» must be filled; delete the guidance comments
> as you go. Keep it plain-English first — the remote owner reads this as a web
> page, not as code.

---

## 1. Motivation

«Why this change, in plain English. What is wrong or missing today, and what the
owner actually asked for. 2–5 sentences. Name the real pain, not the solution.»

Owner decisions (locked in chat «YYYY-MM-DD»):
- «decision 1 — the option the owner picked, in their words»
- «decision 2»

## 2. Current behavior (baseline — do not regress)

«Describe precisely what happens today in the area you're changing — the file(s),
the fields, the validation rules, the exact controls. This is the contract the
change must preserve. If you can't describe it exactly, you don't understand it
well enough to change it safely.»

- «control / field 1 — what it does, what validates it»
- «control / field 2»
- «...»

State clearly which of this logic **stays exactly as-is** vs what actually changes.
> Example (Shelfie edit-popup): "All of this logic is correct and stays exactly
> as-is. This change only moves *where* it renders (inline → modal)."

## 3. New behavior

«The design itself. Break it into the pieces a builder needs: the layout, each
interaction, and the device/mobile requirements. Be concrete enough that two
engineers would build the same thing.»

### 3.1 «Sub-area — e.g. the list / the trigger»
- «...»

### 3.2 «Sub-area — e.g. the new component / the modal»
- «...»

### 3.3 Interactions
- **«Action»:** «trigger → what happens → end state (success AND failure).»
- «... cover every path a real user can take, including the ugly ones.»

### 3.4 «Device / platform requirements (hard)»
«The non-negotiable constraints of the real runtime — the things that only show
up on the real device. Bake them in from the start, don't bolt them on after a
failed live-verify.»
- «e.g. safe-area insets · viewport units · z-index above existing fixed chrome ·
  keyboard behaviour · light + dark tokens»

### 3.5 Accessibility
- «roles / labels / focus management / keyboard operation»

## 4. Architecture (files + responsibilities)

«Name every file touched and what each is responsible for. Distinguish CREATE
from MODIFY, and state explicitly what must NOT change.»

- **`«path/to/file»`** — «create/modify: its responsibility, and the one tricky
  thing to get right.»
- **`«path/to/other»`** — «...»
- **No changes** to «list the files/layers that stay byte-for-byte the same —
  this is a promise the break-plan pass will check.»

## 5. Testing & verification

- «What is genuinely new pure logic that gets a test-first unit test — and what is
  presentation-only and does NOT (do not invent hollow tests to satisfy a ritual).»
- Regression bar: «the full existing suite (N tests) stays green; typecheck clean;
  build clean; «any perf/size budget».»
- «What can only be proven by the adversarial build reviews + the owner's live
  verify on the real device.»

## 6. Edge cases (break-it targets)

«A numbered list of the nasty inputs and states a skeptic should attack. This is
you pre-loading the break-spec pass. Aim for the ones that would actually bite.»

1. «edge case → expected correct outcome»
2. «...»

## 7. Non-goals / out of scope

- «explicitly excluded thing 1 — so the plan and the reviewer don't scope-creep»
- «...»

## 8. Success criteria

- «observable, checkable statement 1 — "tapping X opens Y with the same fields"»
- «works and looks correct on «the real device» in «all relevant contexts»»
- «N tests still green; typecheck + build clean»

---

## 9. Break-spec pass — findings folded in («YYYY-MM-DD»)

«After a fresh skeptical reviewer attacks this spec (see
templates/break-it-prompts.md → Break the SPEC), record every finding here and
point to where in §§1–8 it was folded in. Never silently drop one — fix it or
de-scope it with a stated reason. This table is part of the owner's review trail.»

| # | Sev | Finding | Where folded |
|---|-----|---------|--------------|
| 1 | «Blocker» | «the concrete failure the reviewer found» | «§3.4 — the fix» |
| 2 | «Major» | «...» | «...» |
| 3 | «Minor» | «...» | «...» |
| 4 | «Nit» | «...» | «...» |

**Owner-facing refinement (finding «N»):** «if a finding changes something the
owner decided, explain the trade in plain English and offer to switch back.»

**Verdict after fold-in:** «"sound to proceed to planning" | "needs another
break-spec round".»
