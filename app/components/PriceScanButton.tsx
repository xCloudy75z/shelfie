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
      try {
        const hit = await lookupBarcode(code);
        if (hit) router.push(`/prices?item=${hit.itemId}`);
        else setNotFound(code);
      } catch {
        // Lookup failed (rare) — fall back to the "start tracking" card rather
        // than a silent dead-end.
        setNotFound(code);
      }
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
