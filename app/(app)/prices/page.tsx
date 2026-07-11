import { db } from "@/lib/db";
import { formatAed } from "@/lib/money";
import { computeStats, type PurchaseInput } from "@/lib/price-stats";
import PriceCard from "@/app/components/PriceCard";
import ShelfCheck from "@/app/components/ShelfCheck";
import PriceItemPicker from "@/app/components/PriceItemPicker";

// Reads are per-request against the DB — never at build time.
export const dynamic = "force-dynamic";

/**
 * An item may have purchases logged in different units (e.g. "each" vs "kg").
 * The primary unit is the most frequently used one; ties resolve to the most
 * recent. Purchases arrive sorted most-recent-first, so a strict `>` keeps the
 * earliest-seen (most recent) unit on a tie.
 */
function primaryUnit(purchases: { unit: string }[]): string {
  const counts: Record<string, number> = {};
  for (const p of purchases) counts[p.unit] = (counts[p.unit] ?? 0) + 1;
  let best = purchases[0]?.unit ?? "each";
  let bestCount = -1;
  for (const p of purchases) {
    const c = counts[p.unit];
    if (c > bestCount) {
      bestCount = c;
      best = p.unit;
    }
  }
  return best;
}

export default async function PricesPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item: requestedId } = await searchParams;

  const items = await db.item.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (items.length === 0) {
    return (
      <div className="rise">
        <h1 className="app-title">Prices</h1>
        <p className="app-sub">At the shelf — is this a good price?</p>
        <div className="card">
          <p className="card-kicker">Nothing logged yet</p>
          <p className="card-lead">Log a purchase first</p>
          <p className="card-note">
            Once you&apos;ve logged a few buys of an item, its price story and an
            honest &ldquo;good price?&rdquo; check show up here.
          </p>
        </div>
      </div>
    );
  }

  // Pick the selected item: the requested one if valid, else the most recently
  // purchased item, else the first item alphabetically.
  let selectedId = requestedId && items.some((i) => i.id === requestedId)
    ? requestedId
    : null;
  if (!selectedId) {
    const lastPurchase = await db.purchase.findFirst({
      orderBy: { purchasedAt: "desc" },
      select: { itemId: true },
    });
    selectedId = lastPurchase?.itemId ?? items[0].id;
  }

  const selected = await db.item.findUnique({
    where: { id: selectedId },
    include: { purchases: { orderBy: { purchasedAt: "desc" } } },
  });

  const purchases = selected?.purchases ?? [];
  const unit = primaryUnit(purchases);
  const inputs: PurchaseInput[] = purchases.map((p) => ({
    totalFils: p.totalFils,
    quantity: p.quantity,
    unit: p.unit,
    onOffer: p.onOffer,
    store: p.store,
    purchasedAt: p.purchasedAt,
  }));
  const stats = computeStats(inputs, unit, new Date());

  return (
    <div className="rise">
      <h1 className="app-title">Prices</h1>
      <p className="app-sub">At the shelf — is this a good price?</p>

      {/* Item picker — selecting an item loads its price story instantly. */}
      <PriceItemPicker items={items} selectedId={selectedId} />

      {stats ? (
        <>
          <PriceCard name={selected!.name} stats={stats} />
          <ShelfCheck stats={stats} unit={unit} />

          <div className="card">
            <div
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--ink-faint)",
                marginBottom: 4,
              }}
            >
              Recent buys
            </div>
            {purchases.slice(0, 5).map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 2px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.store}</span>
                {p.onOffer && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--green-strong)",
                    }}
                  >
                    on offer
                  </span>
                )}
                <span
                  style={{ fontSize: 12, color: "var(--ink-soft)", marginLeft: "auto" }}
                >
                  {p.purchasedAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Dubai",
                  })}
                </span>
                <span className="mono" style={{ fontWeight: 700, minWidth: 88, textAlign: "right" }}>
                  {formatAed(p.totalFils)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <p className="card-lead">{selected!.name}</p>
          <p className="card-note">
            No purchases logged for this item yet. Add one on the Log tab and its
            price story will appear here.
          </p>
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-faint)" }}>
        Prices compare same-unit buys only · offers are shown but excluded from
        the &ldquo;usual&rdquo; benchmark.
      </p>
    </div>
  );
}
