"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { setItemCategory } from "@/app/actions/categories";

// Inline styles mirror the other Prices/Month islands — shared design tokens.
const s = {
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
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink-faint)",
    margin: "0 2px 4px",
  },
} satisfies Record<string, CSSProperties>;

export default function ItemCategoryPicker({
  itemId,
  categoryId,
  categories,
}: {
  itemId: string;
  categoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Controlled value: "" means Uncategorized (null).
  const [value, setValue] = useState(categoryId ?? "");

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  async function onChange(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      const res = await setItemCategory(itemId, next || null);
      if ("error" in res) {
        setValue(prev); // revert on failure
        setError(res.error);
        return;
      }
      flash("Category updated ✓");
      router.refresh();
    } catch {
      setValue(prev);
      setError("Couldn't update the category. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <label htmlFor={`cat-${itemId}`} style={s.label}>
        Category
      </label>
      <select
        id={`cat-${itemId}`}
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...s.field, opacity: busy ? 0.6 : 1 }}
      >
        <option value="">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {error && (
        <p
          style={{
            fontSize: 13,
            color: "var(--red)",
            margin: "8px 2px 0",
          }}
        >
          {error}
        </p>
      )}

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
    </div>
  );
}
