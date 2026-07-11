"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { updatePurchase, deletePurchase } from "@/app/actions/purchases";
import { filsFromAed, formatAed } from "@/lib/money";

const STORES = ["Carrefour", "Lulu", "Union Coop", "Other"];

export type EditablePurchaseRow = {
  id: string;
  itemName: string;
  priceAed: string;
  quantity: number;
  unit: string;
  store: string;
  onOffer: boolean;
  /** yyyy-mm-dd (Dubai date) for the <input type="date">. */
  purchasedAt: string;
};

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
} satisfies Record<string, CSSProperties>;

function fmtDate(iso: string): string {
  // iso is yyyy-mm-dd — render it as "5 Jul" without timezone drift.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function EditablePurchases({
  rows,
  monthLabel,
}: {
  rows: EditablePurchaseRow[];
  monthLabel: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 2px" }}>
        No purchases logged for {monthLabel}.
      </p>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <PurchaseRow
          key={row.id}
          row={row}
          open={openId === row.id}
          onToggle={() =>
            setOpenId((cur) => (cur === row.id ? null : row.id))
          }
          onDone={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      ))}
    </>
  );
}

function PurchaseRow({
  row,
  open,
  onToggle,
  onDone,
}: {
  row: EditablePurchaseRow;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const [price, setPrice] = useState(row.priceAed);
  const [qty, setQty] = useState(String(row.quantity));
  const [store, setStore] = useState(row.store);
  const [date, setDate] = useState(row.purchasedAt);
  const [onOffer, setOnOffer] = useState(row.onOffer);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Live-preview the amount from the edited price field.
  const previewFils = filsFromAed(price);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updatePurchase(row.id, {
          priceAed: price,
          quantity: parseFloat(qty) || 1,
          store,
          onOffer,
          purchasedAt: date,
        });
      } catch {
        setError("Could not save — please try again.");
        return;
      }
      onDone();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePurchase(row.id);
      } catch {
        setError("Could not delete — please try again.");
        return;
      }
      onDone();
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "11px 2px",
          background: "none",
          border: 0,
          textAlign: "left",
          cursor: "pointer",
          color: "var(--ink)",
          font: "inherit",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "var(--green-soft)",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            flex: "none",
          }}
          aria-hidden
        >
          🧾
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{row.itemName}</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            {row.store} · {fmtDate(row.purchasedAt)}
            {row.onOffer ? " · offer" : ""}
          </div>
        </div>
        <span className="mono" style={{ marginLeft: "auto", fontWeight: 700 }}>
          {formatAed(filsFromAed(row.priceAed))}
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "4px 2px 16px",
          }}
        >
          <div style={s.row}>
            <div style={s.rowChild}>
              <label style={s.label}>Price (AED)</label>
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                style={s.field}
              />
            </div>
            <div style={s.rowChild}>
              <label style={s.label}>Qty</label>
              <input
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={s.field}
              />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.rowChild}>
              <label style={s.label}>Store</label>
              <select
                value={STORES.includes(store) ? store : "Other"}
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
              <label style={s.label}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={s.field}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 14,
            }}
          >
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

          {confirmDelete ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "var(--red-soft)",
                border: "1px solid var(--line)",
              }}
            >
              <p
                style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink)" }}
              >
                Delete this purchase?
              </p>
              <div style={s.row}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={remove}
                  style={{
                    flex: 1,
                    border: 0,
                    borderRadius: 14,
                    padding: 13,
                    fontSize: 15,
                    fontWeight: 700,
                    background: "var(--red)",
                    color: "#fff",
                    cursor: "pointer",
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  {pending ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1,
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    padding: 13,
                    fontSize: 15,
                    fontWeight: 700,
                    background: "var(--card)",
                    color: "var(--ink)",
                    cursor: "pointer",
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ ...s.row, marginTop: 16 }}>
              <button
                type="button"
                disabled={pending}
                onClick={save}
                style={{
                  flex: 1,
                  border: 0,
                  borderRadius: 14,
                  padding: 13,
                  fontSize: 15,
                  fontWeight: 700,
                  background: "var(--green)",
                  color: "#fff",
                  cursor: "pointer",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                {pending ? "Saving…" : `Save · ${formatAed(previewFils)}`}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
                style={{
                  flex: "0 0 auto",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "13px 16px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "var(--card)",
                  color: "var(--red)",
                  cursor: "pointer",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
