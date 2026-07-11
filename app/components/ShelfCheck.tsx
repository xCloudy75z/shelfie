"use client";

import { useState, type CSSProperties } from "react";
import { filsFromAed } from "@/lib/money";
import { shelfVerdict, type Stats, type Verdict } from "@/lib/price-stats";

// Colour each verdict level with the shared design tokens so the pill reads the
// same in light and dark. "great"/"cheaper" are wins (green), "same" is neutral
// (amber), "pricier" warns (red), and "unknown" stays quiet (muted).
const PILL: Record<Verdict["level"], { bg: string; fg: string; icon: string }> = {
  great: { bg: "var(--green-soft)", fg: "var(--green-strong)", icon: "🟢" },
  cheaper: { bg: "var(--green-soft)", fg: "var(--green-strong)", icon: "✓" },
  same: { bg: "var(--amber-soft)", fg: "var(--amber)", icon: "≈" },
  pricier: { bg: "var(--red-soft)", fg: "var(--red)", icon: "↑" },
  unknown: { bg: "var(--card-2)", fg: "var(--ink-soft)", icon: "•" },
};

const field: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  border: "1px solid var(--line)",
  borderRadius: 12,
  fontSize: 16,
  background: "var(--card)",
  color: "var(--ink)",
  fontFamily: "inherit",
};

type Props = {
  stats: Stats | null;
  unit: string;
};

export default function ShelfCheck({ stats, unit }: Props) {
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  // Label the input with the unit so a per-kg check is never mistaken for a
  // per-item one. "each" needs no qualifier.
  const priceLabel =
    unit && unit !== "each"
      ? `Price per ${unit} on the shelf right now?`
      : "Price on the shelf right now?";

  function check() {
    if (!stats) {
      setVerdict(null);
      return;
    }
    const fils = filsFromAed(value);
    if (!fils) {
      setVerdict(null);
      return;
    }
    setVerdict(shelfVerdict(fils, stats));
  }

  const disabled = !stats;

  return (
    <div className="card">
      <label
        htmlFor="shelf-price"
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink-soft)",
          margin: "0 2px 6px",
        }}
      >
        {priceLabel}
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            id="shelf-price"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                check();
              }
            }}
            placeholder="AED"
            disabled={disabled}
            style={{ ...field, opacity: disabled ? 0.6 : 1 }}
          />
        </div>
        <button
          type="button"
          onClick={check}
          disabled={disabled}
          style={{
            flex: "0 0 auto",
            border: 0,
            borderRadius: 14,
            padding: "13px 18px",
            fontSize: 16,
            fontWeight: 700,
            background: "var(--green-soft)",
            color: "var(--green-strong)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          Check
        </button>
      </div>

      {disabled && (
        <p style={{ margin: "12px 2px 0", fontSize: 13, color: "var(--ink-soft)" }}>
          Log a few purchases of this item to check shelf prices against them.
        </p>
      )}

      {verdict && (
        <div style={{ marginTop: 14 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              fontWeight: 700,
              padding: "8px 14px",
              borderRadius: 999,
              background: PILL[verdict.level].bg,
              color: PILL[verdict.level].fg,
            }}
          >
            <span aria-hidden>{PILL[verdict.level].icon}</span>
            {verdict.label}
          </span>
        </div>
      )}
    </div>
  );
}
