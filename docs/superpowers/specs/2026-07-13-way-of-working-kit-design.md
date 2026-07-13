# The Way-of-Working Kit (repo) — design spec

**Date:** 2026-07-13
**Status:** Design approved in brainstorm (owner). Next: break-spec → build.
**Goal:** A **standalone canonical GitHub repo** that any project — new or existing — adopts to run on the Shelfie way of working. The method is *enforced* by a concise `CLAUDE.md` copied into each project (auto-loaded every session), and *operated* (adopt / audit-retrofit / rebuild / sync) via an `ADOPT.md` procedure file.

---

## 1. The problem it solves

A 16-file Playbook in a folder does **not** get followed — nothing auto-loads it. The only file Claude Code reads into *every* session is a project's **`CLAUDE.md`**. So the enforcement layer must be a concise `CLAUDE.md`; the Playbook is the reference it points to. (This is the owner's own insight: he didn't trust a big doc pile to be followed — correctly.)

## 2. Architecture (owner's option C — canonical master + copy-on-adoption)

- **Canonical master = its own GitHub repo** (`«repo-name»`, owner `xCloudy75z`). Source of truth, versioned.
- **A project adopts by copying the kit into its own repo**, so the rules live *inside the project* and are present in every session — including remote / cloud / phone, where a shared local folder would not be reachable.
- **Improvements happen in the master**; a **sync** action re-copies the latest into a project on demand (never silently — a deliberate step).
- **Self-contained `CLAUDE.md`** so it works even on projects outside the owner's `xCloudy/CLAUDE.md` master; where that master also exists, normal CLAUDE.md layering applies.

## 3. What the master repo contains

| Path | What it is |
|------|-----------|
| `README.md` | Repo intro: what this is, the option-C model, and the three actions. |
| `CLAUDE.md` | **The constitution** — concise, imperative, the enforcer (see §4). |
| `PLAYBOOK/` | The detailed reference (the 9 sections + `templates/`), copied from Shelfie's proven version. |
| `ADOPT.md` | **The operator's manual** — the exact steps Claude follows to adopt / audit / rebuild / sync (see §5). |
| `VERSION` | A simple version stamp so a project can tell how stale its copy is. |

## 4. `CLAUDE.md` — the constitution (the linchpin)

Must be **short and imperative** (target ~1.5–2 pages). A fat CLAUDE.md gets skimmed; a tight one gets followed. Contents:
- **The non-negotiable rules** (distilled from `PLAYBOOK/01-rules.md`): model discipline, privacy, decision authority, build cadence, destructive-action confirms, communication, device/testing model.
- **The gate flow** (brainstorm → spec → break-spec → plan → break-plan → build → break-build ×2 → live-verify), stated as a hard sequence with "no code before an approved design."
- **The skill map** — which superpowers skill drives each stage.
- **Keep docs + hub live** and **verify on the real device** as standing rules.
- **Pointers, not prose:** for detail, read `PLAYBOOK/<file>`; for starters, copy `PLAYBOOK/templates/<file>`.
- A one-line note on layering with any project-level or org-level CLAUDE.md.

## 5. `ADOPT.md` — the operator's manual (the four actions)

Written as procedures Claude executes when the owner asks in plain language:
- **Adopt / follow-forward** (new or existing): copy `CLAUDE.md` + `PLAYBOOK/` (+ `VERSION`) into the target repo; if the project already has a `CLAUDE.md`, *merge* (don't clobber) — surface conflicts. From then on the constitution auto-loads.
- **Audit + retrofit** (existing): read the project, compare to the standard, produce a gap report (no hub? no specs/plans? no break-it trail? no live-verify?), then fix with the owner's OK — stand up the hub + board, backfill a handover, add the `CLAUDE.md`.
- **Rebuild from scratch**: bootstrap a new project on the system per `PLAYBOOK/08-bootstrap-checklist.md` (hub, mockup, first spec, bundle plan).
- **Sync**: compare the project's copied `VERSION` to the master; re-copy the changed kit files; report what changed. Never overwrite a project's *own* CLAUDE.md customizations silently.
- Each action ends by **telling the owner what changed** and what to verify.

## 6. Proving it (build-cadence)

After the repo is built, **prove it by adopting it on one real project** and confirming the `CLAUDE.md` is present + coherent and an action (audit) produces a sensible gap report. Only then consider the optional agent.

## 7. Out of scope (for now)

- **The one-tap agent** — deferred by owner until the kit is proven (build core first).
- Rewriting the owner's existing `xCloudy/CLAUDE.md` — the kit complements it.
- Any automated cron/CI enforcement.

## 8. Done when

The repo exists on GitHub, populated (`README`, `CLAUDE.md`, `PLAYBOOK/`, `ADOPT.md`, `VERSION`) and pushed; the `CLAUDE.md` + `ADOPT.md` pass a break/completeness pass with findings folded in; and it's been proven by adopting it on one real project.
