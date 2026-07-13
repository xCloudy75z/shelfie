# Phase C/D — Camera Scanning Implementation Design

**Date:** 2026-07-13
**Status:** owner-approved (C11 = yes, build it); break-spec pass done & folded in — ready to plan
**Phase:** C + D of the roadmap (`polish-phases-decisions.txt`), built as ONE shared scanner with two entry points (decision D15).
**Feasibility:** PASSED — the `docs/scan-test.html` spike read a real EAN-13 on the owner's iPhone (Safari, JS fallback). iOS has no native `BarcodeDetector`; the JS decoder (html5-qrcode → ZXing) works.

## 1. Purpose
Let the owner **scan a product barcode with the phone camera** instead of typing it, in two moments:
- **After shopping (Log):** scan → identify the item (or start a new one) — decision C12/C13.
- **At the shelf (Prices):** scan → jump straight to that item's price story ("is this a good price?") — decision D15/D16 (the owner's core idea).

## 2. Scope
**In**
- Add **`html5-qrcode`** as a real npm dependency (the library proven in the spike), **lazy-loaded** so it never bloats the main bundle or breaks SSR.
- A reusable client **`BarcodeScanner`** overlay: opens the back camera, decodes product barcodes, **stops on the FIRST clean read** (owner requirement), returns the canonical code, handles errors, and offers cancel / scan-again.
- A **"📷 Scan"** button on **Log** (fills/identifies) and on **Prices** (opens the price story).
- A `lookupBarcode` server action: canonical code → `{ itemId, itemName } | null`.
- Unknown barcode handling: Log → new-item entry with the barcode prefilled (C13); Prices → "No history yet — start tracking?" linking to Log (D16).
- Manual barcode type-in stays as the fallback (C14; PurchaseForm already has it).

**Out**
- No continuous/multi-scan, no batch scanning, no scanning inside the receipt-import flow, no writing to the DB directly from the scanner (it only returns a code; the existing Log/Prices flows persist).

## 3. The scanner component — `app/components/BarcodeScanner.tsx` (client)
- Props: `{ onDetected(code: string): void; onClose(): void }`. `code` is the **canonical** barcode (run through `canonicalizeBarcode`); the caller decides what to do.
- Renders a fixed full-screen overlay (dark scrim) with: a title ("Point at a barcode"), the live camera view (`#reader` div), a subtle scan-window guide, a **Cancel** button, and an inline error area. **Notch-safe (break-spec #8):** add `viewportFit: "cover"` to the app's `viewport` export in `app/layout.tsx`, and pad the overlay controls with `env(safe-area-inset-*)` so Cancel isn't under the notch/home-indicator in the installed PWA.
- **Lazy + SSR-safe (break-spec #3):** the component is `"use client"`. `html5-qrcode` is imported via a dynamic `const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")` **inside** the start routine — **destructure BOTH the class and the format enum from the awaited module.** There must be **NO top-level `import … from "html5-qrcode"` anywhere in the tree** (a static enum import would re-add the browser-only lib to the initial/SSR bundle and can evaluate `navigator`/`document` during `next build`). No `serverExternalPackages` entry is needed (unlike pdfjs-dist, html5-qrcode is never imported by a server module).
- **Start AFTER mount (break-spec #4):** call `.start()` from an effect/gesture handler once the `#reader` div is in the DOM (never synchronously during render, or `getElementById` is null and throws). Hold the `Html5Qrcode` instance in a ref.
- **Formats = GTIN product codes only (break-spec #5/#6):** `formatsToSupport: [EAN_13, EAN_8, UPC_A]`. **Do NOT enable CODE_128/CODE_39** (a shelf-edge label would decode to a bogus non-GTIN "barcode" and get stored) or **UPC_E** (`canonicalizeBarcode` doesn't expand UPC-E→UPC-A, so it wouldn't match a receipt-stored UPC-A). `.start({ facingMode: "environment" }, { fps: 10, qrbox }, onHit, ()=>{})`.
- **Stop on first read:** a `done` guard — on the first hit set `done`, tear down the camera (below), `canonicalizeBarcode` the text; if it yields a code call `onDetected(canonical)` and close; if it's null show "That didn't look like a product barcode — try again" and keep scanning (reset `done`).
- **Hardened async teardown (break-spec #4):** `stop()`/`clear()` are async and throw if called in the wrong state. Gate them: only `stop()` when `instance.getState() === Html5QrcodeScannerState.SCANNING`, then `await stop().then(() => clear()).catch(() => {})`, then null the ref. Run this teardown on the first hit, on Cancel, AND on unmount (a fire-and-forget in the effect cleanup) so the camera track always stops (no lingering light, no "camera already in use" on re-open).
- Errors (permission denied, no camera, insecure context, library load failure): show a friendly inline message + Cancel; never crash.

## 4. Server action — `app/actions/scan.ts`
```
lookupBarcode(raw: string): Promise<{ itemId: string; itemName: string } | null>
```
- `const code = canonicalizeBarcode(raw); if (!code) return null;`
- `const row = await db.barcode.findUnique({ where: { code }, select: { item: { select: { id: true, name: true } } } });`
- Return `row ? { itemId: row.item.id, itemName: row.item.name } : null`. (Barcode.code is the `@id`, so this is a PK lookup.)

## 5. Log integration (`app/components/PurchaseForm.tsx`)
- A **"📷 Scan"** button next to the existing Barcode field. Tapping opens `<BarcodeScanner>`.
- **`PurchaseForm` gains an `initialBarcode?: string` prop** (seeds the `barcode` state, `useState(initialBarcode ?? "")`) so the Prices→Log hand-off can prefill it (break-spec #1, §6).
- `onDetected(code)`:
  1. `setBarcode(code)` (fills the barcode field — barcode-first identity in `addPurchase`/`resolveManualIdentity` resolves it on save).
  2. Call `lookupBarcode(code)`; if a known item, **prefill the item name** and flash "Recognized: <name>" (C12). If null, leave the name blank for a **new item** with the barcode captured (C13) and flash "New item — add its details".
- **Edited-name-vs-scanned-barcode (break-spec #2 — prevents silent mis-filing):** once a scan has set the barcode, if the user then **edits the item name** away from the recognized/current value, **clear the barcode field** (with a subtle note like "barcode cleared — logging as typed"). Rationale: barcode-first identity ignores the typed name, so a stale scanned barcode would silently file the purchase under the barcode's owner and discard the user's edit. Clearing the barcode when the name is manually changed makes the typed name authoritative. (Track a small "barcode came from a scan" flag so hand-typed barcodes aren't cleared by unrelated name typing — apply this only after a scan.)
- The manual barcode text field is unchanged (fallback — C14).

## 6. Prices integration (`app/(app)/prices/page.tsx` + a small client button)
- A **"📷 Scan"** button near the item picker. It's a client island (`PriceScanButton`) that opens `<BarcodeScanner>`.
- `onDetected(code)`:
  1. `lookupBarcode(code)`.
  2. If found → `router.push('/prices?item=<itemId>')` — the price story opens instantly (D15).
  3. If null → show a small inline card: **"No price history yet for this barcode — start tracking?"** with a button linking to **`/log?barcode=<canonicalCode>`** (D16). **The hand-off is REQUIRED wiring (break-spec #1):** the Log server page (`app/(app)/log/page.tsx`) reads `searchParams.barcode`, runs it through `canonicalizeBarcode`, and passes it as `initialBarcode` to `<PurchaseForm>` so the barcode is prefilled at the shelf without re-scanning.

## 7. Library / bundle
- `html5-qrcode` added to `dependencies`. Because it's dynamically imported only when scanning, it lands in an async chunk, not the initial JS. Confirm the main route First-Load JS doesn't grow materially (build output check).
- No CDN at runtime (unlike the spike) — bundled, so it's **reliable and not blocked by a CDN/network/CSP**. **(Correction, break-spec #7: this does NOT mean offline scanning works** — `public/sw.js` is network-first and caches nothing, so a cold offline start can't fetch the scanner chunk and the scanner shows its load-failure message. The network-first SW never serves a stale chunk, so it doesn't make things worse; just don't claim offline scanning. Adding runtime chunk-caching to the SW is out of scope.)

## 8. Privacy
The camera feed is processed **entirely on-device** (the JS decoder runs in the browser; nothing is uploaded). Only the decoded **product barcode** (not personal) is used. No image/frame is stored or sent. Note in the UI ("stays on your phone").

## 9. Testing
**Unit:** `canonicalizeBarcode` is already tested (the only pure logic the scan path adds is calling it). `lookupBarcode` is a thin DB lookup — covered by build + live. No new pure module unless a helper emerges.
**Live verification (owner's iPhone — Safari AND installed/Home-Screen PWA):**
1. Log → 📷 Scan → scan a tracked item's barcode → the item name prefills ("Recognized"); save works.
2. Log → 📷 Scan → scan an untracked barcode → barcode captured, name blank → fill + save creates the item with that barcode.
3. Prices → 📷 Scan → scan a tracked item → its price story opens.
4. Prices → 📷 Scan → scan an untracked barcode → "No history yet — start tracking?" → link to Log.
5. Scanner **stops on the first read** (no repeated fires); "Scan again"/cancel work; camera light turns off on close.
6. Deny camera permission → friendly message, no crash. **Confirm it works in the installed Home-Screen app**, not just Safari.

## 9a. Break-spec pass — resolved (2026-07-13)
- **#1 (Major):** Prices→Log barcode hand-off now REQUIRED wiring — `/log?barcode=` → `canonicalizeBarcode` → `initialBarcode` prop → prefilled field (§5, §6).
- **#2 (Major):** editing the item name after a scan clears the scanned barcode, so a stale barcode can't silently mis-file the purchase under its owner (§5).
- **#3 (Major):** destructure BOTH `Html5Qrcode` and `Html5QrcodeSupportedFormats` from the dynamic `import()`; no top-level package import anywhere (§3).
- **#4 (Major):** hardened async camera teardown (state-gated stop→clear→null-ref, on hit/cancel/unmount) + start-after-mount (§3).
- **#5/#6 (Minor):** formats restricted to EAN_13/EAN_8/UPC_A — drop CODE_128/CODE_39 (shelf-label capture) and UPC_E (no UPC-E→UPC-A expansion) (§3).
- **#7 (Minor):** "works offline" claim corrected (§7).
- **#8 (Minor):** `viewport-fit=cover` + safe-area padding for the installed-PWA overlay (§3).
- **Confirmed sound:** canonical match on the common EAN-13/UPC-A path; barcode-first identity on save; Prices `?item=` routing + zero-purchase item renders; a merged item's barcode resolves to the survivor (better than "null"); privacy; multiple barcodes per item.

## 10. Edge cases for the break-spec pass
- **Installed-PWA camera:** the spike passed in Safari (in-browser); the historically-risky case is standalone/installed mode — must be verified live, and the code must not assume anything Safari-only.
- **SSR / bundle:** does the dynamic import truly keep `html5-qrcode` out of SSR and the initial bundle? Any `window`/`navigator` reference at import time?
- **Canonicalisation mismatch:** the scanned EAN-13 `6291001000012` → `canonicalizeBarcode` → `06291001000012`; stored barcodes are also canonical → they match. Confirm no off-by-padding mismatch vs how receipt/manual barcodes were stored.
- **Camera lifecycle:** does the camera always stop on close/unmount/cancel (no lingering light, no "camera in use" on re-open)?
- **Multiple rapid hits / the `done` guard** race with `stop()`.
- **A barcode owned by an item that was merged/deleted** (Phase B) — `lookupBarcode` returns null gracefully.
- **Prices `router.push` to the scanned item** — same stale-`?item` safety as Phase B.
- **Permission persistence** across scans; **HTTPS** requirement (Vercel ✓).
- **iOS quirks:** `playsinline`, autoplay, orientation, the `viewport-fit=cover` notch.
