"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { filsFromAed, formatAed } from "@/lib/money";
import PurchaseEditModal from "@/app/components/PurchaseEditModal";

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
  const listRef = useRef<HTMLDivElement | null>(null);

  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 2px" }}>
        No purchases logged for {monthLabel}.
      </p>
    );
  }

  // Guard: a Save that moves a purchase to another month can drop it from `rows`
  // before openId clears — treat a missing row as closed (never render row=undefined).
  const openRow = rows.find((r) => r.id === openId);

  return (
    <>
      <div
        ref={listRef}
        tabIndex={-1}
        style={{
          // Show ~4 purchases; the rest scroll inside the box so a big import
          // (a whole receipt) never makes the Month page endlessly long.
          maxHeight: 268,
          overflowY: "auto",
          paddingRight: 4,
          WebkitOverflowScrolling: "touch",
          outline: "none",
        }}
      >
        {rows.map((row) => (
          <PurchaseRow key={row.id} row={row} onOpen={() => setOpenId(row.id)} />
        ))}
      </div>

      {openRow && (
        <PurchaseEditModal
          key={openId!}
          row={openRow}
          fallbackFocusRef={listRef}
          onClose={() => setOpenId(null)}
          onDone={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PurchaseRow({
  row,
  onOpen,
}: {
  row: EditablePurchaseRow;
  onOpen: () => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
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
    </div>
  );
}
