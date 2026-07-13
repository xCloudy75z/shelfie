# templates/ — copy-paste starters

Fill-in starters for every artifact in the Playbook workflow. Each is generic and
project-agnostic — copy one, replace the `«placeholders»`, delete the guidance
comments. (Shelfie appears only as the occasional worked example.)

## The files

| File | What it is | When to use it |
|------|-----------|----------------|
| `spec-template.md` | A design spec: motivation, current behavior to preserve, new behavior, architecture, edge cases, testing, non-goals, success criteria, and a break-spec findings table. | At the **② SPEC** stage, right after brainstorming and before any planning. This is the artifact the first break-it pass attacks. |
| `plan-template.md` | An implementation plan in bite-sized TDD tasks — each with Files, numbered steps (failing test → confirm fail → minimal code → confirm pass → commit), exact commands + expected output, a self-review checklist, and an owner verification checklist. | At the **③ PLAN** stage, once the spec is broken-and-fixed. Hand it to a builder (one fresh subagent per task). |
| `break-it-prompts.md` | The four consolidated skeptic prompts — Break the SPEC, Break the PLAN, Break the BUILD ×2, and the Confirm pass — with fill-ins and a "how to run it" note. | At **every 🛡 gate**. Paste the matching prompt to a fresh reviewer; fold findings in; record them on the board. |
| `session-summary-template.md` | An end-of-session log: goal, what was done (✅/🟡/❌), files created/modified, bundle status, blockers, next 3 tasks, usage, and a cold-start handoff paragraph. | At **session end**, every time. Keeps the trail so a fresh session can resume. |
| `handover-template.md` | A cold-start orientation doc: 30-second summary, the rules, stack & architecture, what's DONE, repo map, the pending item, environment gotchas, and a troubleshooting playbook. | Once per project, kept **live**. The first thing a brand-new session reads. |
| `progress-board.html` | A self-contained, dependency-free live board (auto-refresh, OS light/dark, per-phase cards driven by a `PHASES` array). Preserves every break-it finding, append-only. | Stand up **once at project start**; update as work happens. This is what the remote owner reviews in a browser. |
| `hub-index.html` | The hub **front door** — a card grid linking to the mockup / spec / review / progress board / live app, with a no-flash theme init + toggle, wired to `tokens.css`. | Stand up **once at project start**, alongside the board. The lobby the owner lands on. |
| `tokens.css` | The shared **design-token** stylesheet (surfaces, text, accent + semantics, radius, shadow, font-role split) in light + dark. The single source of look for mockup → hub → app. | Copy in **at the start**, swap the palette/fonts for your project's direction (see `../06-mockups-and-illustration.md`). |

> **Note on this folder vs the spec.** The playbook spec (§4) originally listed the three break-it prompts as separate files and named `progress.html`/`hub.css`; they were intentionally consolidated into `break-it-prompts.md` and renamed to `progress-board.html`/`tokens.css`. Two doc types from `../04-documentation.md` (the **master doc** and the **bundle/build log**) ship no starter on purpose — they're freeform running documents, not fill-in forms.

## How they fit the flow

```
brainstorm → spec-template → 🛡 break-it-prompts (SPEC) → plan-template
   → 🛡 break-it-prompts (PLAN) → build → 🛡 break-it-prompts (BUILD ×2 + confirm)
   → live-verify
```

The **progress-board** and **handover** stay live the whole way; a
**session-summary** closes each working session. See `../README.md` for the full
philosophy and `../08-bootstrap-checklist.md` to stand a new project up on this
system.
