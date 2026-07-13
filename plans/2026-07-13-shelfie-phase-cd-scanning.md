# Phase C/D — Camera Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. ALL work on Opus. Windows: npm/npx via `cmd /c "..."`; `git commit -F <file>`; always `Set-Location -LiteralPath`. No new unit tests (device/UI feature — `canonicalizeBarcode` is already tested); each task's gate is typecheck + build, then TWO break-build passes + live verify on the iPhone (owner rule).

**Goal:** Scan a product barcode with the phone camera — on **Log** to identify/prefill an item (or start a new one), and on **Prices** to open that item's price story ("scan → is this a good price?").

**Architecture:** Add `html5-qrcode` (the lib proven in the spike), **dynamically imported** inside a `"use client"` `BarcodeScanner` overlay (out of SSR + the initial bundle). A thin `lookupBarcode` server action maps a scanned code → item. Two "📷 Scan" buttons (Log, Prices) share the scanner. Canonical-code matching reuses `canonicalizeBarcode`. No schema change.

**Spec:** `docs/superpowers/specs/2026-07-13-phase-cd-scanning-design.md` (break-spec folded in).

**Tech:** Next.js 15 App Router, React 19, Prisma 7, TS strict.

---

## File Structure
- **Modify** `package.json` / `package-lock.json` — add `html5-qrcode`.
- **Create** `app/actions/scan.ts` — `lookupBarcode(raw)`.
- **Create** `app/components/BarcodeScanner.tsx` — client camera overlay (lazy lib, stop-on-read, hardened teardown, GTIN formats).
- **Modify** `app/components/PurchaseForm.tsx` — `initialBarcode` prop, 📷 Scan button, `onDetected` prefill/identify, edited-name clears a scanned barcode.
- **Modify** `app/(app)/log/page.tsx` — read `?barcode=` → canonicalize → `initialBarcode`.
- **Create** `app/components/PriceScanButton.tsx` — client scan button for Prices.
- **Modify** `app/(app)/prices/page.tsx` — render `PriceScanButton`.
- **Modify** `app/layout.tsx` — `viewportFit: "cover"`.

---

### Task 1: Add the scanner dependency

**Files:** `package.json`, `package-lock.json`.

- [ ] **Step 1: Install** — `cmd /c "npm install html5-qrcode@2.3.8"` (pin the spike's version). This updates `package.json` + lockfile.
- [ ] **Step 2: Verify it didn't break anything** — `cmd /c "npm test"` (123 pass), `cmd /c "npm run typecheck"` clean, `cmd /c "npm run build"` clean.
- [ ] **Step 3: Commit** — `git add package.json package-lock.json` → msg `chore(phase-cd): add html5-qrcode scanner dependency`.

---

### Task 2: `lookupBarcode` server action

**Files:** Create `app/actions/scan.ts`.

- [ ] **Step 1: Create it**:

```ts
"use server";

import { db } from "@/lib/db";
import { canonicalizeBarcode } from "@/lib/barcode";

/** Resolve a scanned barcode to the item that owns it, or null. */
export async function lookupBarcode(
  raw: string,
): Promise<{ itemId: string; itemName: string } | null> {
  const code = canonicalizeBarcode(raw);
  if (!code) return null;
  const row = await db.barcode.findUnique({
    where: { code },
    select: { item: { select: { id: true, name: true } } },
  });
  return row ? { itemId: row.item.id, itemName: row.item.name } : null;
}
```

- [ ] **Step 2: Typecheck** — `cmd /c "npm run typecheck"` clean.
- [ ] **Step 3: Commit** — msg `feat(phase-cd): lookupBarcode server action`.

---

### Task 3: `BarcodeScanner` overlay component

**Files:** Create `app/components/BarcodeScanner.tsx`.

- [ ] **Step 1: Create it** (dynamic import; GTIN-only formats; stop-on-first-read; hardened teardown):

```tsx
"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { canonicalizeBarcode } from "@/lib/barcode";

// Type-only reference to the lazily-imported class (no runtime/bundle impact).
type Html5QrcodeInstance = InstanceType<
  Awaited<typeof import("html5-qrcode")>["Html5Qrcode"]
>;

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const instRef = useRef<Html5QrcodeInstance | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("Point the camera at a barcode");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic import — destructure BOTH the class AND the format enum so
        // nothing from html5-qrcode is statically imported (keeps it out of SSR
        // and the initial bundle).
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
        const inst = new Html5Qrcode("reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
          ],
          verbose: false,
        });
        instRef.current = inst;
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (doneRef.current) return;
            const canon = canonicalizeBarcode(decodedText);
            if (!canon) {
              setNote("That didn't look like a product barcode — try again");
              return;
            }
            doneRef.current = true;
            void teardown();
            onDetected(canon);
          },
          () => {}, // per-frame no-match; ignore
        );
        if (cancelled) void teardown();
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(
            /permission|denied|NotAllowed/i.test(msg)
              ? "Camera permission was blocked. Allow it in Settings and try again."
              : "Couldn't start the camera: " + msg,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      void teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never throws: stop() rejects if not scanning, clear() if not stopped — both swallowed.
  async function teardown() {
    const inst = instRef.current;
    instRef.current = null;
    if (!inst) return;
    try { await inst.stop(); } catch { /* not scanning */ }
    try { inst.clear(); } catch { /* already cleared */ }
  }

  function close() {
    void teardown();
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={bar}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{note}</span>
        <button type="button" onClick={close} aria-label="Cancel scanning" style={xBtn}>✕</button>
      </div>
      <div id="reader" style={reader} />
      {error && (
        <div style={errBox}>
          <p style={{ margin: "0 0 10px" }}>⚠ {error}</p>
          <button type="button" onClick={close} style={closeBtn}>Close</button>
        </div>
      )}
      <p style={privacy}>🔒 The camera stays on your phone — only the barcode number is used.</p>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 100, background: "rgba(6,10,7,0.92)",
  display: "flex", flexDirection: "column", alignItems: "center",
  padding: "max(env(safe-area-inset-top), 16px) 16px max(env(safe-area-inset-bottom), 16px)",
};
const bar: CSSProperties = {
  width: "100%", maxWidth: 420, display: "flex", alignItems: "center",
  justifyContent: "space-between", color: "#fff", marginBottom: 14,
};
const xBtn: CSSProperties = {
  border: "1px solid rgba(255,255,255,.4)", background: "transparent", color: "#fff",
  width: 38, height: 38, borderRadius: 10, fontSize: 18, cursor: "pointer", flex: "none",
};
const reader: CSSProperties = {
  width: "100%", maxWidth: 420, aspectRatio: "3 / 4", background: "#000",
  borderRadius: 16, overflow: "hidden",
};
const errBox: CSSProperties = {
  marginTop: 16, maxWidth: 420, width: "100%", background: "var(--red-soft)",
  border: "1px solid var(--red)", color: "var(--red)", borderRadius: 14, padding: 16,
  fontSize: 14, fontWeight: 600, textAlign: "center",
};
const closeBtn: CSSProperties = {
  border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 700, background: "var(--red)", color: "#fff", cursor: "pointer",
};
const privacy: CSSProperties = { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 16, textAlign: "center", maxWidth: 420 };
```

- [ ] **Step 2: Typecheck + build** — `cmd /c "npm run typecheck"` then `cmd /c "npm run build"` (clean; the component is unused so far but must compile, and html5-qrcode must NOT appear in the initial route JS — glance at the build output sizes).
- [ ] **Step 3: Commit** — msg `feat(phase-cd): BarcodeScanner overlay (lazy lib, GTIN-only, stop-on-read)`.

---

### Task 4: Log integration (`PurchaseForm.tsx` + `log/page.tsx`)

**Files:** Modify `app/components/PurchaseForm.tsx`, `app/(app)/log/page.tsx`.

- [ ] **Step 1: PurchaseForm — props + scan state** — add to the `Props` type: `initialBarcode?: string;`. Change the barcode state init to `useState(initialBarcode ?? "")`. Add near the other state: `const [showScanner, setShowScanner] = useState(false);` and `const [barcodeFromScan, setBarcodeFromScan] = useState(false);`. Add the import: `import BarcodeScanner from "@/app/components/BarcodeScanner";` and `import { lookupBarcode } from "@/app/actions/scan";`.

- [ ] **Step 2: PurchaseForm — scan handler**:

```tsx
  function onScan(code: string) {
    setShowScanner(false);
    setBarcode(code);
    setBarcodeFromScan(true);
    lookupBarcode(code)
      .then((hit) => {
        if (hit) { setItemName(hit.itemName); flash(`Recognized: ${hit.itemName}`); }
        else flash("New item — add its details");
      })
      .catch(() => {});
  }
```

- [ ] **Step 3: PurchaseForm — clear a scanned barcode when the name is changed** — define a tiny helper and call it from BOTH the item `<input>` onChange AND `pickSuggestion` (break-plan Minor #2 — a typeahead pick otherwise leaves a stale scanned barcode that would mis-file):

```tsx
  function clearScannedBarcode() {
    if (barcodeFromScan) {
      setBarcode("");
      setBarcodeFromScan(false);
      flash("barcode cleared — logging as typed");
    }
  }
```

In the item `<input>`'s `onChange`, after `setItemName(e.target.value);`, add `clearScannedBarcode();`. In `pickSuggestion(name)`, after `setItemName(name);`, add `clearScannedBarcode();`. (Fires once — `barcodeFromScan` is false afterwards.)

- [ ] **Step 4: PurchaseForm — the Scan button + overlay** — next to the Barcode field label/input, add a button, and render the scanner:

```tsx
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          style={{ ...s.field, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 700 }}
        >
          📷 Scan barcode
        </button>
        {showScanner && (
          <BarcodeScanner onDetected={onScan} onClose={() => setShowScanner(false)} />
        )}
```

(Place the button right under the existing Barcode `<input>`; keep the manual input as the fallback — C14.)

- [ ] **Step 5: log/page.tsx — accept `?barcode=`** — change the signature and pass `initialBarcode`:

```tsx
import { canonicalizeBarcode } from "@/lib/barcode";
// ...
export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string }>;
}) {
  const { barcode } = await searchParams;
  const initialBarcode = canonicalizeBarcode(barcode ?? null) ?? "";
  // ...existing Promise.all...
  return (
    // ...
    <PurchaseForm
      items={items.map((i) => i.name)}
      categories={categories.map((c) => c.name)}
      initialBarcode={initialBarcode}
    />
    // ...
  );
}
```

- [ ] **Step 6: Typecheck + build** — clean.
- [ ] **Step 7: Commit** — msg `feat(phase-cd): scan on Log — identify/prefill + barcode hand-off`.

---

### Task 5: Prices integration (`PriceScanButton.tsx` + `prices/page.tsx`)

**Files:** Create `app/components/PriceScanButton.tsx`; Modify `app/(app)/prices/page.tsx`.

- [ ] **Step 1: Create the button**:

```tsx
"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import { lookupBarcode } from "@/app/actions/scan";

export default function PriceScanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onScan(code: string) {
    setOpen(false);
    setNotFound(null);
    startTransition(async () => {
      const hit = await lookupBarcode(code);
      if (hit) router.push(`/prices?item=${hit.itemId}`);
      else setNotFound(code);
    });
  }

  return (
    <div style={{ margin: "0 0 14px" }}>
      <button type="button" onClick={() => { setNotFound(null); setOpen(true); }} style={btn}>
        📷 Scan a barcode
      </button>
      {open && <BarcodeScanner onDetected={onScan} onClose={() => setOpen(false)} />}
      {notFound && (
        <div style={card}>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>No price history yet for this barcode.</p>
          <Link href={`/log?barcode=${notFound}`} style={link}>Start tracking it →</Link>
        </div>
      )}
    </div>
  );
}

const btn: CSSProperties = {
  width: "100%", border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)",
  borderRadius: 14, padding: 13, fontSize: 15, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};
const card: CSSProperties = {
  marginTop: 10, padding: 14, borderRadius: 12, background: "var(--amber-soft)", border: "1px solid var(--line)",
};
const link: CSSProperties = { color: "var(--green-strong)", fontWeight: 700, textDecoration: "none" };
```

- [ ] **Step 2: Render on Prices — in BOTH branches** — in `app/(app)/prices/page.tsx`, import it (`import PriceScanButton from "@/app/components/PriceScanButton";`). Render `<PriceScanButton />` right under `<PriceItemPicker … />` in the main return, **AND** also inside the early `items.length === 0` empty-state branch (break-plan Minor #1 — a brand-new account with no items is exactly the "scan something I've never tracked → start tracking" case; without this the scan button is hidden there). In the empty state, place `<PriceScanButton />` after the "Nothing logged yet" card.

- [ ] **Step 3: Typecheck + build** — clean.
- [ ] **Step 4: Commit** — msg `feat(phase-cd): scan on Prices — open the item's price story`.

---

### Task 6: Notch-safe viewport (`app/layout.tsx`)

**Files:** Modify `app/layout.tsx`.

- [ ] **Step 1: Add `viewportFit`** — in the exported `viewport` object, add `viewportFit: "cover"` (alongside the existing `themeColor`). This lets the full-screen scanner overlay extend under the notch and its safe-area padding work in the installed PWA.
- [ ] **Step 2: Typecheck + build** — clean.
- [ ] **Step 3: Commit** — msg `feat(phase-cd): viewport-fit cover for the full-screen scanner`.

---

### Task 7: Verification gate (break-build ×2 + live)

- [ ] **Step 1: Full suite + typecheck + build** — `cmd /c "npm test"` (123 green), typecheck clean, build clean. **Check the build output:** `/log` and `/prices` First-Load JS should NOT balloon (html5-qrcode must be an async chunk, not initial).
- [ ] **Step 2: Break-build pass #1** — fresh skeptical Opus vs the diff + spec adversarial cases (dynamic-import keeps lib out of initial bundle; camera teardown/no-leak; canonical match; edited-name clears barcode; Prices→Log hand-off; error UX). Fix → commit.
- [ ] **Step 3: Break-build pass #2** — a SECOND independent fresh skeptic (owner rule). Fix → commit.
- [ ] **Step 4: Push + verify Ready** — `git push origin main`; then confirm the Vercel deploy reached `● Ready` (force a fresh deploy if the git integration doesn't fire — see the ops lessons). No migration this phase.
- [ ] **Step 5: Live verify (owner's iPhone — Safari AND installed Home-Screen PWA)** — per spec §9: Log scan→identify (recognized name prefills) + new-item; Prices scan→price story + "start tracking" hand-off prefilling the barcode; stops on first read; camera light turns off; permission-denied message; **confirm it works in the installed app.**
- [ ] **Step 6: Update board + docs** — flip the Phase C/D card steps to done on `docs/progress.html` + the hub timeline node; note it in HANDOVER.md. Commit + push.

---

## Notes
- No schema change, no migration.
- The ONE correctness-sensitive spot is `BarcodeScanner`'s dynamic import + camera teardown; both build reviews must confirm the lib stays out of the initial bundle and the camera never leaks.
- Keep the manual barcode field (fallback) and don't touch the receipt-import flow.
