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
