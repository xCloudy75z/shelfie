# 05 — The hub & how a remote owner reviews

The owner isn't sitting next to the machine. He works **remotely**, and the only thing he can reliably open is a **web page in a browser** — not local files, not a dev preview on `localhost`, not a tool's inline widget, not a screenshot pasted into chat history he has to scroll back to. So the whole system rests on one hard rule:

> **Nothing is "approved" until the owner has seen it as a live web page.**

Everything reviewable — the design, the mockup, the adversarial findings, the build progress — is **published as HTML to a hub** the owner can reach from his phone. The only other channel that works for a remote owner is an **in-chat multiple-choice question**: short, tappable, no typing. Those two together — *published page* + *multiple-choice ask* — are the entire review loop.

## Why this shape, not the obvious alternatives

- **Why not just show him the code / a diff?** He's non-technical and remote. A diff is not a review surface for him. A rendered page is.
- **Why not a dev preview?** A `localhost` preview only exists on the build machine. The owner can't open it. Anything he must review has to be on a public URL.
- **Why not screenshots in chat?** They go stale, they're not interactive, and he can't click into a mockup or expand a finding. A real page can.
- **Why multiple-choice for decisions?** It's the one input a remote, non-technical owner can give instantly and unambiguously. Open-ended "what do you think?" stalls; "A, B, or C?" ships.

---

## The pages (each one is a real URL)

The hub is a small set of static HTML files served by **GitHub Pages out of the repo's `/docs` folder** — push to the default branch and the folder *is* the website. No build step, no server.

| Page | File | What the owner does there |
|------|------|---------------------------|
| Front door / hub | `docs/index.html` | The lobby — a sidebar links to the live app, the docs timeline, and the tools below. Start here. |
| Live app | (Vercel URL) | The actual working app, linked from the hub — the real thing, not a preview. |
| Interactive mockup | `docs/mockup.html` | Click through the proposed screens **before any code exists** (see `06`). |
| Design spec | `docs/spec.html` | The written design in plain English — what's being built and why. |
| Adversarial review | `docs/review.html` | The break-it findings written up long-form (the owner's deep-review record). |
| **Build progress** | `docs/progress.html` | **The primary review surface** — the live board of every phase. Detailed below. |
| Master doc | `docs/masterdoc.html` | The full "how it all works" reference, kept current. |

All of these share one design system (`docs/shelfie.css` + `docs/theme.js`) so the hub *looks like the app* — reviewing the hub is itself a taste of the product's look and feel.

---

## The progress board in detail — the owner's main window

`docs/progress.html` is where the owner spends his review time. It's built to be glanceable and trustworthy:

- **It auto-refreshes.** A `<meta http-equiv="refresh" content="60">` reloads the page about every 60 seconds, so a board left open on his phone keeps catching up as work lands — he never has to manually reload to see the latest.
- **A progress tally + a status chip per phase.** The top shows `✓ N shipped · ◐ N in progress · ◦ N queued`, and each phase card carries a **Shipped / In progress / Queued** badge and a colored left border (green / amber / grey). Progress is readable in one second.
- **Append-only, persistent, fixed-order cards.** This is the core discipline. Every phase or build gets its **own permanent card**, added to the *end* of the list. You **never overwrite a shipped card and never reorder them** — you only update a card's own fields in place while it's active. The board is a growing history, not a dashboard that resets. The owner can scroll back to any past phase and see exactly what happened.
- **Every card preserves its break-it findings.** Each card carries the plain-English results of the adversarial passes that gate that phase. Because the owner delegates deep review to those findings (see `03`), **the findings on this board *are* his review record** — they must stay, verbatim in spirit, forever.

### The card shape (what each phase card holds)

The board is driven by a `PHASES` array in the page; each entry is one card:

| Field | Meaning |
|-------|---------|
| `id` | Stable key for the card — never reused, never changed. |
| `title` | The phase name, e.g. "Phase B · Merge tool". |
| `status` | `done` / `active` / `queued` — drives the badge + border color. |
| `desc` | One plain-English line: what this phase gives the owner. |
| `note` | The current standing — e.g. "Shipped & verified on the owner's iPhone (123 tests)". |
| `steps[]` | The workflow checklist for the phase — each `{n: name, s: state}` where state is `done` / `active` / `todo`, rendered as ✓ / ◐ / ◦ chips (Design approved · Break the spec · Plan · Break the plan · Build · Break the build ×2 · Live verify). |
| `breaks[]` | The adversarial record — a list of `{stage, verdict, items[]}`. `stage` = which gate ("🛡️ Break the SPEC"), `verdict` = the one-line outcome ("2 fixed"), `items` = the plain-English findings. Optional `link` points to the full write-up. |

The page renders all of this from the array — add a phase by appending one object; update a live phase by editing only its own fields. That mechanical rule is what keeps the history honest.

> Recording break-it findings here is **step 3 of "after every pass"** in `03-stress-tests.md`. The stress tests produce the findings; this board is where they live for good.

---

## Publishing + verifying (the ops that bite)

Publishing is "push to the default branch." The trap is assuming *pushed = live*. **GitHub Pages rebuilds on a lag of roughly 1–2 minutes**, and until it finishes, the old content is what the URL serves — worse, **a brand-new file or sub-folder returns 404** until the rebuild indexes it. If you tell the owner "it's live" the instant you push, he may open a 404 or a stale page and lose trust in the board.

**The rule: don't announce a page as live until you've confirmed it with your own eyes (via a fetch), not the git push.**

The polling technique, in words:

1. Push to the default branch.
2. **Fetch the actual URL** (not the local file) and check the response — for a brand-new page, that it isn't a 404; for an update, that a **specific new string** you just added is present in the returned HTML.
3. If it's still stale or 404, **wait ~20–30 seconds and fetch again.** Repeat a few times — Pages usually settles inside 1–2 minutes.
4. **Only once the new content actually shows** do you give the owner the URL and say it's ready.

This is a live-verify of the *page itself*, in the same spirit as live-verifying the app on the real device.

## Hosting-deploy verification (the app, not the hub)

The same "push ≠ done" trap applies to the **app's own host** (for Shelfie, Vercel). A `git push` *usually* triggers the host to build and deploy — but not always, and a push that deploys the code is not proof the deploy **succeeded**. So after any push that should ship the app:

- **Confirm the deploy actually reached "Ready"** on the host — check the deployment status, don't infer it from the push.
- **If the build didn't fire, or it failed, force a fresh deploy** from current source rather than reusing a stale prior build.
- Only then treat the live app as updated.

The exact commands (how to list deployments, how to force one, the Windows secret-handling gotchas) live in the **project's own docs**, because they're host- and OS-specific — this Playbook just fixes the *pattern*: **verify the deploy reached Ready; if it didn't fire, force it.**

---

## The design system the hub carries

Every hub page pulls the same two shared files, so the hub is visually one product — and doubles as a **live sample of the app's look**:

- **`docs/shelfie.css`** — the design tokens: a "fresh market receipt" palette (warm paper, deep charcoal-green, amber, red) as CSS variables, plus the display / body / mono font stack (Fraunces · Hanken Grotesk · Spline Sans Mono) and shared bits (badges, cards, radius, shadows). Light **and** dark values are both defined as variable sets.
- **`docs/theme.js`** + a tiny inline `<head>` snippet — a **persistent light/dark toggle with no flash of the wrong theme**. The head snippet reads the saved choice (or the OS preference) and stamps `data-theme` on the root element *before the page paints*, so there's no flash; `theme.js` then wires the floating 🌙/☀️ button to flip and remember the choice in `localStorage`.

Because the hub renders in the app's real tokens and fonts, the owner reviewing the board is also, quietly, reviewing the app's taste. The mockup and full design detail live in `06-mockups-and-illustration.md`.

---

## How the owner actually reviews (the walkthrough)

Put together, one review round looks like this:

1. **You publish** the relevant page (mockup, spec, review, or the updated progress board) to `/docs` and push.
2. **You poll the URL** until the new content actually shows (per the lag rule above).
3. **You send the owner two things in chat:** the live URL, and a **multiple-choice question** — e.g. *"Mockup's up: [link]. Go with (A) the two-tab layout, (B) three tabs, or (C) something else?"*
4. **He opens the link on his phone**, clicks around / reads the findings, and **replies with a letter.**
5. **His answer is the approval** — recorded, folded in, and the next gate begins.

That loop — publish, verify-it's-live, ask a tappable question, get a letter back — is how a remote owner stays fully in control of a build he never sees the code of.
