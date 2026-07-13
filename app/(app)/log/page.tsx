import PurchaseForm from "@/app/components/PurchaseForm";
import ReceiptImport from "@/app/components/ReceiptImport";
import { db } from "@/lib/db";
import { formatAed } from "@/lib/money";
import { canonicalizeBarcode, displayBarcode } from "@/lib/barcode";

// Keep this route out of the static build so `next build` never touches the DB.
export const dynamic = "force-dynamic";
// Importing a whole receipt writes ~90 rows in one transaction; give the server
// action room beyond the default function limit so a large receipt can't time out.
export const maxDuration = 30;

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string }>;
}) {
  const { barcode } = await searchParams;
  // Show the human/printed form in the field (not the zero-padded canonical);
  // addPurchase re-canonicalizes on save, so this round-trips correctly.
  const canon = canonicalizeBarcode(barcode ?? null);
  const initialBarcode = canon ? displayBarcode(canon) : "";
  // Existing item names feed the autocomplete; categories feed the picker.
  const [items, categories, recent] = await Promise.all([
    db.item.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    db.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    db.purchase.findMany({
      take: 5,
      orderBy: { purchasedAt: "desc" },
      select: {
        id: true,
        totalFils: true,
        store: true,
        purchasedAt: true,
        item: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="rise">
      <h1 className="app-title">Log</h1>
      <p className="app-sub">
        Home from the shop? Import the receipt. Just one item? Add it below.
      </p>

      <ReceiptImport />

      <PurchaseForm
        items={items.map((i) => i.name)}
        categories={categories.map((c) => c.name)}
        initialBarcode={initialBarcode}
      />

      {recent.length > 0 && (
        <div className="card">
          <p className="card-kicker">Just logged</p>
          {recent.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {p.item.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  {p.store} ·{" "}
                  {p.purchasedAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Dubai",
                  })}
                </div>
              </div>
              <span className="mono" style={{ marginLeft: "auto", fontWeight: 700 }}>
                {formatAed(p.totalFils)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
