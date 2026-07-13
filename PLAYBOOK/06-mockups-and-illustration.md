# 06 — Mockups & illustration (see it before you build it)

The workflow (`02-workflow.md`) puts a visual step **between brainstorm and code**: once a design is agreed in words, you make it *visible* before writing any product code. This file is how that's done — the clickable mockup, the shared design system, and the odd diagram.

The one-line rule: **the owner should be able to click the app before it exists.**

## Why mock up before you code

Words hide disagreement. "A clean dashboard with the budget at the top" sounds agreed — until two people picture two different screens. A picture you can tap collapses that ambiguity to zero.

- **It de-risks the build.** The look and the navigation are settled *before* a line of product code exists, so you don't discover on day three that the whole layout is wrong.
- **A remote owner can actually judge it.** The mockup is published to the hub (see `05-hub-and-review.md`) as a real web page. The owner clicks through it on their phone and reacts to the true thing, not a description.
- **It's cheap to throw away.** A mockup is fake data and static screens — changing it costs minutes. Changing a built feature costs a rebuild.
- **It doubles as a living taste of the app.** Long after approval, the mockup stays on the hub as the reference for "this is what we agreed it should feel like."

This is a hard gate for anything with a new look or a new flow: **no UI code until there's an agreed visual.**

## What a good mockup includes

Not a wireframe of grey boxes — a believable slice of the real app:

1. **The real screens/tabs.** Every top-level view the feature touches, reachable from a real nav bar — not one hero screen in isolation.
2. **Fake but realistic data.** Real-looking store names, prices, dates, categories. Realistic data exposes layout problems (long names, big numbers, empty states) that "Lorem ipsum" hides.
3. **The key flows, tapped end-to-end.** The owner can actually walk the main journey — open a receipt, add an item, switch a month — and hit the toasts and confirmations along the way.
4. **The *real* styling.** Same fonts, colours, radius, shadow, spacing as the shipped app will use. The owner is judging the true look, so the mockup must *be* the true look — see the design system below.

Shelfie's mockup (`docs/mockup.html`) is a single self-contained HTML file: an iPhone frame with a lock screen, a bottom tab bar, a sliding receipt sheet, working light/dark toggle, and fake pantry data — all clickable, all on the hub. It was signed off before the first real component was written.

## The design system (define the look once, share it everywhere)

The mockup, the hub, and the real app must look identical. That only works if they draw from **one set of design tokens** — CSS variables defined once and copied into each surface. Change a token, and every surface moves together.

**This is a pattern to copy, not a mandate.** Pick your own palette and fonts — but structure them the same way. Here's Shelfie's set as a worked example.

### Token categories

Group the variables by role so the vocabulary is shared across the whole app:

| Category | Role | Shelfie tokens |
|----------|------|----------------|
| **Paper** | Page backgrounds | `--paper`, `--paper-2` |
| **Card** | Raised surfaces | `--card`, `--card-2` |
| **Ink** | Text, three weights | `--ink`, `--ink-soft`, `--ink-faint` |
| **Line** | Borders, dividers | `--line`, `--line-soft` |
| **Accent** | The brand colour | `--green`, `--green-strong`, `--green-soft` |
| **Semantic** | Status meaning | `--green` (good) · `--amber` (warn) · `--red` (over) — each with a `-soft` background |
| **Form / shape** | Fonts, radius, shadow | `--font-display`, `--font-body`, `--font-mono`, `--radius`, `--shadow` |

### The font-role split

Three fonts, each with one job — never mix them up:

- **Display serif** (`--font-display`: Fraunces) — headings and the app title. Gives character.
- **Body grotesk** (`--font-body`: Hanken Grotesk) — all running text, labels, buttons. Gives clarity.
- **Mono numerals** (`--font-mono`: Spline Sans Mono, with `font-variant-numeric: tabular-nums`) — prices and amounts, so columns of numbers line up.

### Light + dark, done properly

Two things are easy to get wrong. Both matter:

- **Theme via a `data-theme` attribute.** `:root` holds the light tokens; `:root[data-theme="dark"]` overrides them. Components never hard-code a colour — they only read tokens, so both themes come for free.
- **No-flash init — set the theme *before first paint*.** A tiny inline script in `<head>`, running before the body renders, reads the saved theme and stamps `data-theme` on `<html>`. Without it, the page flashes light then snaps to dark — ugly and amateur. Shelfie's one-liner:

  ```html
  <script>(function(){try{var t=localStorage.getItem('shelfie-theme');
    if(!t)t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
    document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
  ```

- **A persistent toggle.** A single control writes the choice to `localStorage` and flips the attribute; the init script reads it back next load. Default to the OS preference when nothing is saved.

## Pick a distinctive aesthetic — and commit to it

The biggest trap is the **generic AI default**: the flat blue-and-white, system-font, rounded-rectangle look that every unopinionated app wears. It's forgettable.

Instead, choose a **real design direction** with a name you can point back to, and apply it consistently. Shelfie's is **"fresh market receipt"** — warm paper backgrounds, a deep charcoal-green accent, a serif display face, a faint paper-grain texture, dashed "perforation" dividers like a till receipt. Every screen honours it. The direction is a decision you can defend, not a default you fell into.

One clear aesthetic, applied everywhere, beats three tasteful ones fighting each other.

## Illustration & diagrams

When a flow or an architecture is easier *seen* than read, draw it — but keep it honest and minimal. A diagram earns its place by explaining something; it never decorates.

- **In docs:** a simple ASCII flow (like the one in `README.md`) travels anywhere, diffs cleanly in git, and needs no tooling.
- **On the hub:** an SVG or a mermaid diagram when the shape genuinely helps — a state machine, a data pipeline, a screen-to-screen flow.
- **The test:** if the diagram says something the surrounding sentence already says, delete it. If it replaces a paragraph you'd otherwise struggle to write, keep it. Match the real system exactly — a diagram that's subtly wrong is worse than none.

## The consistency rule (mockup → hub → product)

The mockup's tokens **become** the app's tokens. This isn't a coincidence to hope for — it's a rule you enforce by sharing the actual variables.

On Shelfie, `docs/shelfie.css` defines the system; `docs/mockup.html` uses it; the hub pages use it; and `app/globals.css` is the *same tokens ported into the real app* (its header literally says "Ported from docs/shelfie.css", with the fonts wired to `next/font`). The values are identical — same hexes, same radius, same shadow — so the shipped app matches the thing the owner approved, pixel for pixel.

When you touch a colour, change it in the token source, and let every surface inherit it. Never let the app and the mockup drift apart.

## Checklist — before building any UI feature

- [ ] Is there an agreed **mockup or visual** for this screen/flow?
- [ ] Does it use **fake but realistic data**, not grey boxes?
- [ ] Is it styled with the **real design tokens** (so the owner judges the true look)?
- [ ] Is it **published to the hub** so the remote owner can click it?
- [ ] Has the owner **signed off** on look *and* navigation before any product code?
- [ ] Do light **and** dark both render, with **no theme flash** on load?
- [ ] Will the built feature draw from the **same tokens** the mockup used?

If any box is unchecked, you're about to code a look nobody has approved. Stop and mock it up first.
