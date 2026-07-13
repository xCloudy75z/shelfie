# Phase C/D — Camera Scanning Implementation Design

**Date:** 2026-07-13
**Status:** owner-approved (C11 = yes, build it); pending break-spec pass
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
- Renders a fixed full-screen overlay (dark scrim) with: a title ("Point at a barcode"), the live camera view (`#reader` div), a subtle scan-window guide, a **Cancel** button, and an inline error area.
- **Lazy + SSR-safe:** `html5-qrcode` is imported via a dynamic `await import("html5-qrcode")` **inside** the start routine (never at module top level — it touches `navigator`/`document`). The component is `"use client"`; the import only runs in the browser after a user gesture (opening the scanner).
- Start: `new Html5Qrcode("reader", { formatsToSupport: [EAN_13, EAN_8, UPC_A, UPC_E, CODE_128, CODE_39] })` → `.start({ facingMode: "environment" }, { fps: 10, qrbox }, onHit, ()=>{})`.
- **Stop on first read:** a `done` guard — on the first hit, set `done`, `stop()` + `clear()` the camera, `canonicalizeBarcode` the text, call `onDetected(canonical)`, and close (or show a tiny "✓ <code>" flash then close). No repeat fires (fixes the spike's repeated-HIT behaviour).
- Cleanup: `stop()`/`clear()` on unmount and on Cancel so the camera light never lingers.
- Errors (permission denied, no camera, insecure context, library load failure): show a friendly inline message + Cancel; never crash. If `canonicalizeBarcode` returns null (non-barcode), show "That didn't look like a product barcode — try again" and keep scanning.

## 4. Server action — `app/actions/scan.ts`
```
lookupBarcode(raw: string): Promise<{ itemId: string; itemName: string } | null>
```
- `const code = canonicalizeBarcode(raw); if (!code) return null;`
- `const row = await db.barcode.findUnique({ where: { code }, select: { item: { select: { id: true, name: true } } } });`
- Return `row ? { itemId: row.item.id, itemName: row.item.name } : null`. (Barcode.code is the `@id`, so this is a PK lookup.)

## 5. Log integration (`app/components/PurchaseForm.tsx`)
- A **"📷 Scan"** button next to the existing Barcode field. Tapping opens `<BarcodeScanner>`.
- `onDetected(code)`:
  1. `setBarcode(code)` (fills the barcode field — the existing barcode-first identity in `addPurchase`/`resolveManualIdentity` will resolve it on save even with no name).
  2. Call `lookupBarcode(code)`; if it returns a known item, **prefill the item name** with that item's name and flash "Recognized: <name>" (identify — C12). If null, leave the name blank for a **new item** with the barcode captured (C13) and flash "New item — add its details".
- The manual barcode text field is unchanged (fallback — C14).

## 6. Prices integration (`app/(app)/prices/page.tsx` + a small client button)
- A **"📷 Scan"** button near the item picker. It's a client island (`PriceScanButton`) that opens `<BarcodeScanner>`.
- `onDetected(code)`:
  1. `lookupBarcode(code)`.
  2. If found → `router.push('/prices?item=<itemId>')` — the price story opens instantly (D15).
  3. If null → show a small inline card: **"No price history yet for this barcode — start tracking?"** with a button linking to `/log` (optionally carrying the barcode so Log can prefill it) (D16).

## 7. Library / bundle
- `html5-qrcode` added to `dependencies`. Because it's dynamically imported only when scanning, it lands in an async chunk, not the initial JS. Confirm the main route First-Load JS doesn't grow materially (build output check).
- No CDN at runtime (unlike the spike) — bundled, so it works offline and isn't blocked by a CSP/network.

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
