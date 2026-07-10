# 🛒 Shelfie

A deliberately **simple** UAE grocery price + budget tracker. One person, one PIN, three tabs.

> Standing at the shelf — *is this price actually good, or have I paid less before?*

## What it does (and nothing more)

1. **Log** — add a purchase fast, or **import the Carrefour PDF receipt** and save a whole trip at once.
2. **Prices** — search an item, see last / best / average / highest price, and check if today's shelf price is a good one.
3. **Month** — spend vs. budget with a green/amber/red pace, and where it went by category.

That's it. No trips, no coach engines, no alerts, no multi-user plumbing.

## Status

🟡 **Design review** — clickable mockups + spec published for approval before any app code is written.

- 👉 **Review the mockups & spec:** _(GitHub Pages link added once published)_

## Privacy

This repo contains **only code and mockups**. Real receipts, spending data, databases, and secrets are hard-blocked from ever being committed (see `.gitignore`). Mockups use fake sample groceries, never real purchase data.

## Stack (planned)

Next.js · TypeScript · Prisma · Postgres (Neon) · Tailwind · deployed on Vercel. Free deterministic PDF receipt parser — no AI, no per-scan cost.
