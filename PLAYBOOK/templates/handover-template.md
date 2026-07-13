# «Project» — Handover

> The cold-start doc. A brand-new session (or a new engineer) reads THIS FIRST and
> is oriented in 30 seconds, then works without needing anyone's memory. Update it
> as reality changes — a stale handover is worse than none.

---

## 30-second orientation

- **Project:** «what it is, in one line — who it's for, what it does.»
- **Live URL(s):** «production URL» · «hub / progress board URL»
- **Local path:** `«C:\...\Project»`
- **Current state:** «shipped & live | mid-build on «feature» | blocked on «X».»
- **The ONE open item:** «the single most important thing to do next. If you read
  nothing else, do this.»

## The rules

The way of working is non-negotiable and lives in the Playbook. Before changing
code, know:
- `PLAYBOOK/01-rules.md` — «the non-negotiables: model discipline, decision
  authority, cadence, comms.»
- `PLAYBOOK/README.md` — the flow (brainstorm → spec → break → plan → break →
  build → break ×2 → live-verify). **No code before an approved, broken-and-fixed
  design.**
- `PLAYBOOK/03-stress-tests.md` + `templates/break-it-prompts.md` — the four gates.

## Tech stack & architecture

- **Stack:** «framework + version · language · data layer · test runner · hosting.»
- **Key libraries:** «list the load-bearing ones and what they're for.»
- **Shape:** «2–4 sentences — how the pieces fit. Client/server boundary, where
  business logic lives, how data flows.»
- **Design system:** `«path/to/tokens.css»` — «CSS-variable tokens, light + dark.
  Reuse them; don't hand-roll colors.»

## What's DONE (don't redo)

«The shipped features, so a fresh session doesn't rebuild them. One line each.»
- ✅ «feature» — «what it does, where it lives.»
- ✅ «feature» — «...»

## Repo map

«The directories that matter and what's in each. Skip node_modules etc.»
- `«app/» or «src/»` — «routes / pages / components.»
- `«app/actions/» / «api/»` — «server-side mutations.»
- `«lib/»` — «pure helpers, types, formatters (client-safe).»
- `«tests/»` — «unit tests.»
- `«docs/»` — «the hub, spec/review pages, progress board.»
- `«plans/»`, `«docs/…/specs/»` — «per-feature plans and specs.»

## The pending item / next step

«Expand the ONE open item from the orientation. What it is, why it's next, the
first concrete action, and where its spec/plan live (or that they need writing).»

## Environment gotchas

«The platform-specific traps that will burn a fresh session. Be specific.»
- «e.g. git isn't on PATH — use «full path».»
- «e.g. wrap npm/npx/deploy commands in «cmd /c "…"».»
- «e.g. paths with [brackets] need -LiteralPath in PowerShell.»
- «e.g. deploy env-var / cold-start / secret-encoding quirks.»

## Troubleshooting playbook

«Real issues hit before, so they're solved in seconds not hours. Add to this
every time something bites. Format: symptom → why → the exact fix.»

| Issue (symptom) | Why it happens | Exact fix |
|-----------------|----------------|-----------|
| «what you see» | «root cause» | «the command / change that fixes it» |
| «...» | «...» | «...» |
