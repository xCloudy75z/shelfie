"use client";

import {
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { type ParsedReceipt } from "@/lib/receipt";
import {
  importReceipt,
  parseReceiptUpload,
  type ImportDraft,
  type Hint,
} from "@/app/actions/receipt";
import { parsePriceFils, aedFromFils, formatAed } from "@/lib/money";
import { guessCategory, PRESET_CATEGORIES } from "@/lib/categories";
import { dubaiToday } from "@/lib/dates";
import BarcodeLine from "@/app/components/BarcodeLine";

// ---------------------------------------------------------------------------
// Receipt import — the whole trip in one tap.
//
// State machine:  idle → reading → review → saving → done   (+ error)
//
// The PDF is uploaded to a Server Action which extracts its text with pdf.js
// running on Node's main thread (reliable where the browser path hangs on iOS
// Safari). The server stores nothing — it discards the PDF and returns the
// parsed items for review; only reviewed names + prices are then saved.
// ---------------------------------------------------------------------------

type Phase = "idle" | "reading" | "review" | "saving" | "done" | "error";

// Which kind of failure the error screen is showing:
//   "read"  — the server couldn't open/parse the PDF.
//   "parse" — the PDF read fine but no lines looked like grocery items.
type ErrorKind = "read" | "parse";

// An editable review row. Price is held as a free-text AED string so the user
// can type; it is validated → fils only at save time.
type Row = {
  name: string;
  quantity: number;
  unit: "each" | "kg";
  priceAed: string; // line total in AED, editable
  category: string;
  barcode: string | null; // canonical GTIN-14 from the parse, carried unedited
  onOffer: boolean; // per-item "on offer" toggle (excluded from best-price benchmark)
  linkedItemId?: string; // "same as my X?" accepted → reuse that item + remember barcode
  ignoreBarcodeMatch?: boolean; // "not this item" → detach a recognised barcode
  // Server recognition hints, carried ON the row (not a parallel array) so that
  // removing a row never mis-aligns a hint with the wrong item.
  knownItemName: string | null; // this row's barcode already files as this item
  nameKnown: boolean; // name already matches a tracked item
  suggestItemId: string | null; // fuzzy "same as my X?" candidate id
  suggestName: string | null; // …and its friendly name
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
  // Small pill-shaped text button for the recognise / detach / link affordances.
  linkBtn: {
    border: "1px solid var(--line)",
    background: "var(--card)",
    color: "var(--ink-soft)",
    borderRadius: 8,
    padding: "3px 9px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;

// Build the import payload for one reviewed row. Returns null when the price is
// invalid. Carries the per-item on-offer / detach / same-as choices through to
// the server so identity + offer handling honour what the owner reviewed.
function draftFromRow(row: Row): ImportDraft | null {
  const lineFils = parsePriceFils(row.priceAed);
  if (lineFils === null) return null;
  const quantity =
    Number.isFinite(row.quantity) && row.quantity > 0 ? row.quantity : 1;
  return {
    name: row.name.trim(),
    quantity,
    unit: row.unit,
    lineFils,
    barcode: row.barcode ?? null,
    onOffer: row.onOffer,
    ...(row.linkedItemId ? { linkedItemId: row.linkedItemId } : {}),
    ...(row.ignoreBarcodeMatch ? { ignoreBarcodeMatch: true } : {}),
  };
}

export default function ReceiptImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Whether the error is a read failure or a parsed-but-empty result.
  const [errorKind, setErrorKind] = useState<ErrorKind>("read");

  // Parsed snapshot (badge + discount note read from the ORIGINAL parse).
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  // Editable rows (start as a copy of parsed.items).
  const [rows, setRows] = useState<Row[]>([]);
  const [rowErrors, setRowErrors] = useState<Set<number>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  // Duplicate-import confirmation (server said this trip looks already imported).
  const [dupWhen, setDupWhen] = useState<string | null>(null);

  // Purchase date for the whole trip (yyyy-mm-dd). Auto-filled from the receipt
  // when the parse found a date; otherwise falls back to today (Asia/Dubai).
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [dateAutoDetected, setDateAutoDetected] = useState(false);

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
    setPurchaseDate("");
    setDateAutoDetected(false);
    setErrorMsg(null);
    setErrorKind("read");
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
      // Upload the PDF; the server extracts + parses it and discards the bytes.
      const fd = new FormData();
      fd.append("file", file);
      const res = await parseReceiptUpload(fd);

      if ("error" in res) {
        setErrorMsg(res.error);
        setErrorKind("read");
        setPhase("error");
        return;
      }

      const p = res.parsed;
      if (p.items.length === 0) {
        // The server read the file but nothing parsed as a grocery item.
        setErrorMsg("Read the file, but couldn't find any items");
        setErrorKind("parse");
        setPhase("error");
        return;
      }

      const hints = res.hints;
      const blankHint: Hint = {
        knownItemName: null,
        nameKnown: false,
        suggestItemId: null,
        suggestName: null,
      };

      setParsed(p);
      setRows(
        p.items.map((it, idx) => {
          const h = hints[idx] ?? blankHint;
          return {
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            priceAed: aedFromFils(it.lineFils).toFixed(2),
            category: guessCategory(it.name) ?? "",
            barcode: it.barcode ?? null,
            onOffer: false,
            knownItemName: h.knownItemName,
            nameKnown: h.nameKnown,
            suggestItemId: h.suggestItemId,
            suggestName: h.suggestName,
          };
        }),
      );
      setPurchaseDate(p.purchaseDateISO ?? dubaiToday());
      setDateAutoDetected(p.purchaseDateISO != null);
      setRowErrors(new Set());
      setSaveError(null);
      setDupWhen(null);
      setPhase("review");
    } catch {
      setErrorMsg("Couldn't read that file — please try again.");
      setErrorKind("read");
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
    const items: ImportDraft[] = [];
    rows.forEach((r, i) => {
      const draft = draftFromRow(r);
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

    // Fingerprints come from the RAW parse held in state — never recomputed from
    // edited rows, so renaming a line on review can't change the dedupe key.
    if (!parsed) {
      setSaveError("Couldn't save — please try again.");
      return;
    }
    const grandTotalFils = parsed.grandTotalFils;

    setPhase("saving");
    startTransition(async () => {
      try {
        const res = await importReceipt({
          items,
          grandTotalFils,
          paidFils: parsed.paidFils,
          fingerprint: parsed.fingerprint,
          legacyFingerprint: parsed.legacyFingerprint,
          ...(purchaseDate ? { purchasedAt: purchaseDate } : {}),
          force,
        });
        if ("ok" in res) {
          const note =
            res.warnings && res.warnings.length > 0
              ? ` (${res.warnings.length} note${res.warnings.length === 1 ? "" : "s"})`
              : "";
          flash(`Imported ${res.imported} items ✓${note}`);
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
          🔒 Read securely and discarded — only items &amp; prices are saved,
          never your name or card.
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
    const isParse = errorKind === "parse";
    return (
      <div className="card">
        <p style={{ fontSize: 32, margin: "0 0 8px" }}>😕</p>
        <p style={{ fontWeight: 600, margin: "0 0 4px" }}>
          {errorMsg ?? "Something went wrong."}
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px" }}>
          {isParse
            ? "The file opened fine, but none of its lines looked like grocery items."
            : "Make sure you picked the PDF Carrefour emails you."}
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
      {/* Purchase date — auto-filled from the receipt, editable before saving. */}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="import-purchase-date" style={s.miniLabel}>
          Purchase date
        </label>
        <input
          id="import-purchase-date"
          type="date"
          value={purchaseDate}
          onChange={(e) => {
            setPurchaseDate(e.target.value);
            setDateAutoDetected(false);
          }}
          style={s.field}
        />
        {dateAutoDetected && (
          <p
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              margin: "4px 2px 0",
            }}
          >
            detected from receipt — change if needed
          </p>
        )}
      </div>

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
              // No captured barcode → flag the whole row red so it's easy to
              // spot while scanning the list before saving (owner request R1).
              border: `1px solid ${row.barcode ? "var(--line)" : "var(--red)"}`,
              borderLeft: `${row.barcode ? "1px" : "4px"} solid ${row.barcode ? "var(--line)" : "var(--red)"}`,
              borderRadius: 12,
              background: row.barcode ? "var(--card-2)" : "var(--red-soft)",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <label style={s.miniLabel}>Item</label>
                  {!row.barcode && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                        color: "#fff",
                        background: "var(--red)",
                        borderRadius: 999,
                        padding: "3px 9px",
                        marginBottom: 4,
                      }}
                    >
                      NO BARCODE
                    </span>
                  )}
                </div>
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

            {/* captured barcode for this row (display-only; canonical → printed) */}
            <BarcodeLine codes={[row.barcode]} />

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
                      {c === "" ? "Uncategorized" : c}
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

            {/* Per-item controls: on-offer, recognise/detach, same-as, flag */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={row.onOffer}
                  onChange={(e) => updateRow(i, { onOffer: e.target.checked })}
                />
                On offer
              </label>

              {/* No-barcode rows are now flagged red at the row level (the
                  "NO BARCODE" badge by the item name — owner request R1), which
                  supersedes the older amber "check this" pill. */}

              {/* Recognised barcode → files automatically; owner can detach (C2). */}
              {row.knownItemName && !row.ignoreBarcodeMatch && (
                <>
                  <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                    → files as <strong>{row.knownItemName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateRow(i, { ignoreBarcodeMatch: true })}
                    style={s.linkBtn}
                  >
                    not this item
                  </button>
                </>
              )}
              {row.knownItemName && row.ignoreBarcodeMatch && (
                <>
                  <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                    barcode detached
                  </span>
                  <button
                    type="button"
                    onClick={() => updateRow(i, { ignoreBarcodeMatch: false })}
                    style={s.linkBtn}
                  >
                    undo
                  </button>
                </>
              )}

              {/* Fuzzy "same as my X?" link for new/renamed rows. */}
              {row.suggestName && !row.ignoreBarcodeMatch && (
                row.linkedItemId ? (
                  <>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "var(--green-strong)",
                        fontWeight: 600,
                      }}
                    >
                      linked to {row.suggestName} ✓
                    </span>
                    <button
                      type="button"
                      onClick={() => updateRow(i, { linkedItemId: undefined })}
                      style={s.linkBtn}
                    >
                      clear
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                      same as my <strong>{row.suggestName}</strong>?
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateRow(i, {
                          linkedItemId: row.suggestItemId ?? undefined,
                        })
                      }
                      style={s.linkBtn}
                    >
                      yes, link
                    </button>
                  </>
                )
              )}
            </div>
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
