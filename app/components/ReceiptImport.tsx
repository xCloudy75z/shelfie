"use client";

import {
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  parseReceipt,
  computeFingerprint,
  type DraftItem,
  type ParsedReceipt,
} from "@/lib/receipt";
import { importReceipt } from "@/app/actions/receipt";
import { parsePriceFils, aedFromFils, formatAed } from "@/lib/money";
import { guessCategory, PRESET_CATEGORIES } from "@/lib/categories";

// ---------------------------------------------------------------------------
// Receipt import — the whole trip in one tap.
//
// State machine:  idle → reading → review → saving → done   (+ error)
//
// Everything runs on-device: the PDF bytes are parsed in the browser (pdfjs is
// pulled in via a DYNAMIC import so it never lands in a server bundle), and
// only reviewed item names + prices are sent to the server action to save.
// ---------------------------------------------------------------------------

type Phase = "idle" | "reading" | "review" | "saving" | "done" | "error";

// An editable review row. Price is held as a free-text AED string so the user
// can type; it is validated → fils only at save time.
type Row = {
  name: string;
  quantity: number;
  unit: "each" | "kg";
  priceAed: string; // line total in AED, editable
  category: string;
};

// Inline styles mirror PurchaseForm / docs/mockup.html, all driven by the
// shared design tokens in globals.css so the panel is theme-aware.
const s = {
  primaryBtn: {
    width: "100%",
    border: 0,
    borderRadius: 14,
    padding: 15,
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    background: "var(--green)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  softBtn: {
    flex: 1,
    border: "1px solid var(--line)",
    borderRadius: 14,
    padding: 15,
    fontSize: 16,
    fontWeight: 700,
    background: "var(--card)",
    color: "var(--ink)",
    cursor: "pointer",
  },
  field: {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid var(--line)",
    borderRadius: 10,
    fontSize: 15,
    background: "var(--card)",
    color: "var(--ink)",
    fontFamily: "inherit",
  },
  miniLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink-faint)",
    margin: "0 2px 4px",
  },
} satisfies Record<string, CSSProperties>;

function diFromRow(row: Row): DraftItem | null {
  const lineFils = parsePriceFils(row.priceAed);
  if (lineFils === null) return null;
  const quantity =
    Number.isFinite(row.quantity) && row.quantity > 0 ? row.quantity : 1;
  return {
    name: row.name.trim(),
    quantity,
    unit: row.unit,
    // unit price incl VAT, derived from the (possibly edited) line total.
    unitPriceFils: Math.round(lineFils / quantity),
    lineFils,
  };
}

export default function ReceiptImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Parsed snapshot (badge + discount note read from the ORIGINAL parse).
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  // Editable rows (start as a copy of parsed.items).
  const [rows, setRows] = useState<Row[]>([]);
  const [rowErrors, setRowErrors] = useState<Set<number>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  // Duplicate-import confirmation (server said this trip looks already imported).
  const [dupWhen, setDupWhen] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  function reset() {
    setPhase("idle");
    setParsed(null);
    setRows([]);
    setRowErrors(new Set());
    setSaveError(null);
    setDupWhen(null);
    setErrorMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // --- Idle → Reading → Review ------------------------------------------------
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file fires onChange again.
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    setPhase("reading");
    setErrorMsg(null);
    try {
      // Dynamic import keeps pdfjs-dist out of every server bundle.
      const { extractReceiptLines } = await import("@/lib/receipt-extract");
      const lines = await extractReceiptLines(file);
      const p = parseReceipt(lines);
      if (p.items.length === 0) {
        setErrorMsg(
          "No grocery items were recognised — is this the Carrefour receipt PDF?",
        );
        setPhase("error");
        return;
      }
      setParsed(p);
      setRows(
        p.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          priceAed: aedFromFils(it.lineFils).toFixed(2),
          category: guessCategory(it.name),
        })),
      );
      setRowErrors(new Set());
      setSaveError(null);
      setDupWhen(null);
      setPhase("review");
    } catch {
      setErrorMsg("Couldn't read that file — is it the Carrefour PDF?");
      setPhase("error");
    }
  }

  // --- Row editing ------------------------------------------------------------
  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
    // Clear this row's price error as the user types.
    if (patch.priceAed !== undefined && rowErrors.has(idx)) {
      setRowErrors((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setRowErrors(new Set()); // indices shift; recomputed on next save
    setDupWhen(null);
  }

  // Live footer sum (fils) from the current, possibly-edited rows.
  const liveSumFils = rows.reduce(
    (sum, r) => sum + (parsePriceFils(r.priceAed) ?? 0),
    0,
  );

  // --- Save -------------------------------------------------------------------
  function save(force: boolean) {
    setSaveError(null);

    // Validate every price → fils; collect offending rows.
    const bad = new Set<number>();
    const items: DraftItem[] = [];
    rows.forEach((r, i) => {
      const draft = diFromRow(r);
      if (!draft || !r.name.trim()) bad.add(i);
      else items.push(draft);
    });
    if (bad.size > 0 || items.length === 0) {
      setRowErrors(bad);
      setSaveError(
        items.length === 0
          ? "Add at least one item with a valid price."
          : "Some rows need a valid name and price above 0.",
      );
      return;
    }

    const grandTotalFils = parsed?.grandTotalFils ?? null;
    const fingerprint = computeFingerprint(items, grandTotalFils);

    setPhase("saving");
    startTransition(async () => {
      try {
        const res = await importReceipt({
          items,
          grandTotalFils,
          fingerprint,
          force,
        });
        if ("ok" in res) {
          flash(`Imported ${res.imported} items ✓`);
          reset();
          router.refresh();
          return;
        }
        if ("duplicate" in res) {
          setDupWhen(res.when);
          setPhase("review");
          return;
        }
        // { error }
        setSaveError(res.error);
        setPhase("review");
      } catch {
        setSaveError("Couldn't save — please try again.");
        setPhase("review");
      }
    });
  }

  // === Render ================================================================

  // --- Idle -------------------------------------------------------------------
  if (phase === "idle") {
    return (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onFile}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={s.primaryBtn}
        >
          📄 Import Carrefour receipt (PDF)
        </button>
        <p
          className="mono"
          style={{
            textAlign: "center",
            fontSize: 11.5,
            color: "var(--ink-faint)",
            margin: "8px 0 0",
          }}
        >
          🔒 Read on your device — nothing personal leaves your phone.
        </p>
        {toast && <Toast msg={toast} />}
      </>
    );
  }

  // --- Reading ----------------------------------------------------------------
  if (phase === "reading") {
    return (
      <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div className="spinner" />
        <p style={{ color: "var(--ink-soft)", margin: "16px 0 0", fontSize: 14 }}>
          Finding items &amp; prices…
        </p>
        <style>{spinnerCss}</style>
      </div>
    );
  }

  // --- Error ------------------------------------------------------------------
  if (phase === "error") {
    return (
      <div className="card">
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>😕</p>
        <p style={{ fontWeight: 600, margin: "0 0 4px" }}>
          {errorMsg ?? "Something went wrong."}
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px" }}>
          Make sure you picked the PDF Carrefour emails you.
        </p>
        <button type="button" onClick={reset} style={s.primaryBtn}>
          Try another file
        </button>
      </div>
    );
  }

  // --- Review / Saving --------------------------------------------------------
  const saving = phase === "saving";
  const p = parsed;
  const discountFils =
    p && p.paidFils != null && p.paidFils < (p.grandTotalFils ?? 0)
      ? (p.grandTotalFils ?? 0) - p.paidFils
      : 0;

  return (
    <div className="card">
      {/* Badge */}
      {p?.matchesTotal ? (
        <div style={badge("green")}>
          Total matches ✓ · {formatAed(p.sumFils)}
        </div>
      ) : (
        <div style={badge("amber")}>
          {p && p.warnings.length > 0
            ? p.warnings.join(" ")
            : "Please check the items below before saving."}
        </div>
      )}

      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "12px 2px" }}>
        Glance down, fix anything odd, then save the whole trip.
      </p>

      {discountFils > 0 && (
        <p
          style={{
            fontSize: 12.5,
            color: "var(--ink-soft)",
            background: "var(--amber-soft)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "8px 10px",
            margin: "0 0 12px",
          }}
        >
          Receipt had a {formatAed(discountFils)} discount — items are logged at
          their shelf prices.
        </p>
      )}

      {/* Editable rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "var(--card-2)",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={s.miniLabel}>Item</label>
                <input
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  style={s.field}
                  aria-label="Item name"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label={`Remove ${row.name}`}
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--card)",
                  color: "var(--ink-faint)",
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  fontSize: 16,
                  cursor: "pointer",
                  marginTop: 19,
                  flex: "none",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <div style={{ width: 74, flex: "none" }}>
                <label style={s.miniLabel}>Qty</label>
                <div
                  style={{
                    ...s.field,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 4,
                  }}
                >
                  <span className="mono">{row.quantity}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                    {row.unit === "kg" ? "kg" : "×"}
                  </span>
                </div>
              </div>
              <div style={{ width: 104, flex: "none" }}>
                <label style={s.miniLabel}>Price (AED)</label>
                <input
                  inputMode="decimal"
                  value={row.priceAed}
                  onChange={(e) => updateRow(i, { priceAed: e.target.value })}
                  aria-label="Line price in AED"
                  style={{
                    ...s.field,
                    borderColor: rowErrors.has(i) ? "var(--red)" : "var(--line)",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={s.miniLabel}>Category</label>
                <select
                  value={row.category}
                  onChange={(e) => updateRow(i, { category: e.target.value })}
                  aria-label="Category"
                  style={s.field}
                >
                  {(PRESET_CATEGORIES.includes(row.category)
                    ? PRESET_CATEGORIES
                    : [row.category, ...PRESET_CATEGORIES]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {rowErrors.has(i) && (
              <p
                style={{
                  color: "var(--red)",
                  fontSize: 12,
                  fontWeight: 600,
                  margin: "6px 2px 0",
                }}
              >
                Enter a valid name and price above 0.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer running total */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 800,
          fontSize: 16,
          margin: "16px 2px",
        }}
      >
        <span>
          {rows.length} item{rows.length === 1 ? "" : "s"}
        </span>
        <span className="mono">{formatAed(liveSumFils)}</span>
      </div>

      {saveError && (
        <p
          style={{
            color: "var(--red)",
            fontSize: 13,
            fontWeight: 600,
            margin: "0 2px 12px",
          }}
        >
          {saveError}
        </p>
      )}

      {/* Duplicate confirm */}
      {dupWhen ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "var(--amber-soft)",
            border: "1px solid var(--line)",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: 14 }}>
            This receipt looks already imported (on{" "}
            <strong>{formatWhen(dupWhen)}</strong>). Import anyway?
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(true)}
              style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Import anyway"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setDupWhen(null)}
              style={{ ...s.softBtn, opacity: saving ? 0.6 : 1 }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            disabled={saving || rows.length === 0}
            onClick={() => save(false)}
            style={{
              ...s.primaryBtn,
              opacity: saving || rows.length === 0 ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : `Save ${rows.length} item${rows.length === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={reset}
            style={{ ...s.softBtn, opacity: saving ? 0.6 : 1 }}
          >
            Cancel
          </button>
        </div>
      )}

      {toast && <Toast msg={toast} />}
    </div>
  );
}

// --- Small helpers ----------------------------------------------------------

function badge(kind: "green" | "amber"): CSSProperties {
  const green = kind === "green";
  return {
    padding: "10px 12px",
    borderRadius: 12,
    fontSize: 13.5,
    fontWeight: 600,
    background: green ? "var(--green-soft)" : "var(--amber-soft)",
    color: green ? "var(--green-strong)" : "var(--amber)",
    border: `1px solid var(--line)`,
  };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "an earlier date";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

function Toast({ msg }: { msg: string }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 104,
        transform: "translateX(-50%)",
        background: "#101828",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 600,
        zIndex: 70,
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        whiteSpace: "nowrap",
      }}
    >
      {msg}
    </div>
  );
}

const spinnerCss = `
.spinner{width:34px;height:34px;border:3px solid var(--green-soft);
  border-top-color:var(--green);border-radius:50%;
  animation:spin .8s linear infinite;margin:0 auto}
@keyframes spin{to{transform:rotate(360deg)}}
`;
