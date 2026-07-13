# 01 — The rules (non-negotiables)

These hold on every project. Adapt the *specifics* (which model, which currency) but keep the *shape*.

## 1. Model discipline
- **Pick a model policy and hold it.** On Shelfie: **all Opus, every step and every subagent** — passed explicitly when dispatching subagents. The point is consistency and quality over cost.
- A common split (if you want one): a stronger model for *planning / hard debugging / recommendations*, a fast model for *mechanical execution*. Never mix models within a single stage. If execution hits an unexpected wall, escalate back to the planning model.

## 2. Privacy is top-critical (absolute)
- **Never read, recognise, or store the owner's personal data** — name, card/loyalty numbers, email, phone, address, transaction/receipt IDs. If you cross any, discard it immediately; never write it to memory.
- **Don't open a file that may contain personal data raw.** Extract only the non-personal structure via a script that **redacts before you see it** (e.g. keep product/price lines, mask any long digit-run, drop personal keywords, delete the raw immediately). *Content* like product names + prices is not personal; the owner's *identity* is.
- **Never handle secrets** — DB passwords, API keys, session secrets. The owner sets those in the host dashboard himself. The repo holds only code + mockups; real data/secrets are hard-blocked in `.gitignore`.

## 3. Decision authority
| Situation | Rule |
|-----------|------|
| Bug fixes, small improvements, refactors, tests, docs | **Do automatically** |
| New feature design, architecture change, removing a feature | **Ask the owner first** |
| New tool/service, any cost, scope/timeline change | **Ask first** |
| Changing a *locked* decision or bundle sequence | **Ask first** |
| Deleting files | Show the full list → get explicit approval → confirm done |
| Destructive data ops (wipe/reset/drop) | **Always confirm first** |
| Requirements unclear | **Stop and ask** — never assume |

## 4. Build cadence
Never build everything in one autonomous run. **Build the core happy-path, package it into a real runnable artifact early, verify the real thing runs, then stop and check in** before layering more. Tests passing is *not* proof the app runs — launch the actual thing.

## 5. Locked decisions
Every project accumulates **locked design decisions**. Treat them as immutable. To change one: surface it, get explicit approval, then update the record. Write them down where they can't be missed (the project's registry/handover).

## 6. Destructive actions confirm first
Any delete/reset/wipe shows a confirmation before executing, and is built confirmation-gated in the UI. For actions that are hard to reverse or outward-facing (sending, publishing, purchasing), confirm first unless already authorised.

## 7. Communication
- **Plain English first**, the *why* before the *what*, short scannable messages (headings, bullets, numbered steps).
- **Honest about failures** — show the evidence (real output), never claim done without proof.
- **Status icons only in checklists/summaries** (✅ done · 🟡 in progress · ❌ blocked/not started), not in prose.
- **Report outcomes faithfully:** if tests fail, say so with the output; if a step was skipped, say that; when something is verified, state it plainly without hedging.

## 8. Device & testing model
- Know your **device of record** — the real device the owner keeps and judges on (Shelfie: an iPhone, incl. the installed home-screen app). **Live-verify targets the real device**, not a simulator or the dev machine.
- If the owner is **remote**, he sees only live web pages — so everything reviewable is published to the hub (see `05-hub-and-review.md`), and decisions are asked as in-chat multiple-choice.
