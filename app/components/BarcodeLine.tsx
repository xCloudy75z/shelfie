import { displayBarcode } from "@/lib/barcode";

/**
 * Show one or more product barcodes as small muted, monospace numbers.
 * Presentational only — no state, no hooks — so it renders in both the Prices
 * server component and the ReceiptImport client component. Renders nothing when
 * there are no usable codes. Each code is a11y-labelled as a barcode; the glyph
 * is decorative (aria-hidden).
 */
export default function BarcodeLine({
  codes,
}: {
  codes: (string | null | undefined)[];
}) {
  const shown = codes.map(displayBarcode).filter((c) => c.length > 0);
  if (shown.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        margin: "4px 0 0",
      }}
    >
      {shown.map((code, i) => (
        <span
          key={`${code}-${i}`}
          className="mono"
          aria-label={`Barcode ${code}`}
          style={{
            fontSize: 12,
            color: "var(--ink-faint)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span aria-hidden="true">🏷</span>
          {code}
        </span>
      ))}
    </div>
  );
}
