"use client";

import { useRef, useState, useTransition, type CSSProperties } from "react";
import { addPurchase, type AddPurchaseResult } from "@/app/actions/purchases";
import { parsePriceFils } from "@/lib/money";

const STORES = ["Carrefour", "Lulu", "Union Coop", "Other"];

// Inline styles mirror the Log form in docs/mockup.html, driven by the shared
// design tokens in globals.css so the form is theme-aware without adding new
// global classes (this task only touches the three Log-tab files).
const s = {
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--ink-soft)",
    margin: "12px 2px 6px",
  },
  field: {
    width: "100%",
    padding: "13px 14px",
    border: "1px solid var(--line)",
    borderRadius: 12,
    fontSize: 16,
    background: "var(--card)",
    color: "var(--ink)",
    fontFamily: "inherit",
  },
  row: { display: "flex", gap: 10 },
  rowChild: { flex: 1, minWidth: 0 },
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
    marginTop: 16,
  },
  toggleWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
} satisfies Record<string, CSSProperties>;

type Props = {
  items: string[];
  categories: string[];
};

type Confirm = { id: string; name: string };

export default function PurchaseForm({ items, categories }: Props) {
  const [itemName, setItemName] = useState("");
  const [priceAed, setPriceAed] = useState("");
  const [qty, setQty] = useState("1");
  const [store, setStore] = useState("Carrefour");
  const [category, setCategory] = useState("");
  const [onOffer, setOnOffer] = useState(false);

  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // --- Custom typeahead (replaces <datalist>, which is unreliable on iOS Safari) ---
  const [showSug, setShowSug] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const blurTimer = useRef<number | null>(null);

  // Match existing item names: startsWith ranked before includes, cap at 6.
  const query = itemName.trim().toLowerCase();
  const suggestions =
    query.length === 0
      ? []
      : (() => {
          const starts: string[] = [];
          const contains: string[] = [];
          for (const name of items) {
            const low = name.toLowerCase();
            if (low === query) continue; // exact match: nothing left to suggest
            if (low.startsWith(query)) starts.push(name);
            else if (low.includes(query)) contains.push(name);
          }
          return [...starts, ...contains].slice(0, 6);
        })();

  const sugOpen = showSug && suggestions.length > 0;

  function pickSuggestion(name: string) {
    setItemName(name);
    setShowSug(false);
    setActiveIdx(-1);
  }

  function onItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setShowSug(false);
      setActiveIdx(-1);
      return;
    }
    if (!sugOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIdx]);
    }
  }

  function clearForm() {
    setItemName("");
    setPriceAed("");
    setQty("1");
    setStore("Carrefour");
    setCategory("");
    setOnOffer(false);
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  // One entry point for all three paths (first save, "yes same", "no new").
  function run(extra: { chosenItemId?: string; confirmNewItem?: boolean }) {
    setError(null);
    startTransition(async () => {
      let res: AddPurchaseResult;
      try {
        res = await addPurchase({
          itemName: itemName.trim(),
          priceAed,
          quantity: parseFloat(qty) || 1,
          unit: "each",
          store,
          onOffer,
          categoryName: category || undefined,
          ...extra,
        });
      } catch {
        setError("Could not save — please try again.");
        return;
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if ("needsConfirm" in res) {
        setConfirm(res.suggestion);
        return;
      }
      setConfirm(null);
      clearForm();
      flash("Saved ✓  ·  form cleared");
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim()) {
      setError("Add an item name first.");
      return;
    }
    if (parsePriceFils(priceAed) === null) {
      setError("Enter a valid price above 0.");
      return;
    }
    run({});
  }

  const canSubmit = itemName.trim().length > 0 && !pending;

  return (
    <form onSubmit={onSubmit}>
      {/* Import receipt — placeholder, ships in Plan 2 */}
      <button
        type="button"
        disabled
        style={{
          width: "100%",
          border: 0,
          borderRadius: 14,
          padding: 15,
          fontSize: 16,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "var(--green-soft)",
          color: "var(--green-strong)",
          cursor: "not-allowed",
          opacity: 0.85,
        }}
        title="Coming soon"
      >
        📄 Import receipt (PDF)
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
        Coming soon · a whole trip in one tap
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "var(--ink-faint)",
          fontSize: 12,
          margin: "18px 2px",
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        or add one item
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      <div className="card">
        <label htmlFor="pf-item" style={s.label}>
          Item
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="pf-item"
            value={itemName}
            onChange={(e) => {
              setItemName(e.target.value);
              setShowSug(true);
              setActiveIdx(-1);
            }}
            onFocus={() => setShowSug(true)}
            onBlur={() => {
              // Delay so a tap on a suggestion registers before the list closes.
              blurTimer.current = window.setTimeout(() => setShowSug(false), 120);
            }}
            onKeyDown={onItemKeyDown}
            placeholder="Start typing… e.g. Milk 2L"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={sugOpen}
            aria-autocomplete="list"
            aria-controls="pf-item-list"
            style={s.field}
          />
          {sugOpen && (
            <ul
              id="pf-item-list"
              role="listbox"
              style={{
                listStyle: "none",
                margin: "6px 0 0",
                padding: 4,
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 30,
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                boxShadow: "var(--shadow)",
                maxHeight: 258,
                overflowY: "auto",
              }}
            >
              {suggestions.map((name, i) => (
                <li
                  key={name}
                  role="option"
                  aria-selected={i === activeIdx}
                  // onMouseDown fires before the input's blur, so the pick lands.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (blurTimer.current) window.clearTimeout(blurTimer.current);
                    pickSuggestion(name);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    padding: "11px 12px",
                    borderRadius: 9,
                    fontSize: 15,
                    color: "var(--ink)",
                    cursor: "pointer",
                    background: i === activeIdx ? "var(--green-soft)" : "transparent",
                  }}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={s.row}>
          <div style={s.rowChild}>
            <label htmlFor="pf-price" style={s.label}>
              Price (AED)
            </label>
            <input
              id="pf-price"
              inputMode="decimal"
              value={priceAed}
              onChange={(e) => setPriceAed(e.target.value)}
              placeholder="0.00"
              style={s.field}
            />
          </div>
          <div style={s.rowChild}>
            <label htmlFor="pf-qty" style={s.label}>
              Qty
            </label>
            <input
              id="pf-qty"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={s.field}
            />
          </div>
        </div>

        <div style={s.row}>
          <div style={s.rowChild}>
            <label htmlFor="pf-store" style={s.label}>
              Store
            </label>
            <select
              id="pf-store"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              style={s.field}
            >
              {STORES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div style={s.rowChild}>
            <label htmlFor="pf-cat" style={s.label}>
              Category{" "}
              <span style={{ color: "var(--green-strong)" }}>· auto</span>
            </label>
            <select
              id="pf-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={s.field}
            >
              <option value="">Auto</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={s.toggleWrap}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            This was on offer
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={onOffer}
            aria-label="This was on offer"
            onClick={() => setOnOffer((v) => !v)}
            style={{
              width: 46,
              height: 28,
              borderRadius: 999,
              border: 0,
              padding: 0,
              position: "relative",
              cursor: "pointer",
              transition: "background .15s",
              background: onOffer ? "var(--green)" : "var(--line)",
              flex: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: onOffer ? 21 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
                transition: "left .15s",
                boxShadow: "0 1px 2px rgba(0,0,0,.2)",
              }}
            />
          </button>
        </div>

        {error && (
          <p
            style={{
              color: "var(--red)",
              fontSize: 13,
              fontWeight: 600,
              margin: "12px 2px 0",
            }}
          >
            {error}
          </p>
        )}

        {confirm ? (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 14,
              background: "var(--amber-soft)",
              border: "1px solid var(--line)",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink)" }}>
              Is this the same as <strong>{confirm.name}</strong>?
            </p>
            <div style={s.row}>
              <button
                type="button"
                disabled={pending}
                onClick={() => run({ chosenItemId: confirm.id })}
                style={{
                  ...s.primaryBtn,
                  marginTop: 0,
                  opacity: pending ? 0.6 : 1,
                }}
              >
                Yes, same item
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run({ confirmNewItem: true })}
                style={{
                  flex: 1,
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: 15,
                  fontSize: 16,
                  fontWeight: 700,
                  background: "var(--card)",
                  color: "var(--ink)",
                  cursor: "pointer",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                No, it&apos;s new
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            style={{ ...s.primaryBtn, opacity: canSubmit ? 1 : 0.6 }}
          >
            {pending ? "Saving…" : "Save purchase"}
          </button>
        )}
      </div>

      <p
        style={{
          textAlign: "center",
          fontSize: 12,
          color: "var(--ink-faint)",
          margin: "0 2px",
        }}
      >
        Category auto-fills once an item is known — you set it once, ever.
      </p>

      {toast && (
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
          {toast}
        </div>
      )}
    </form>
  );
}
