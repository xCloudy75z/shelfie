import Link from "next/link";
import { db } from "@/lib/db";
import { formatAed, aedFromFils } from "@/lib/money";
import { dubaiMonthKey, dubaiToday, monthKeyToLabel, cycleRange } from "@/lib/dates";
import { setBudget } from "@/app/actions/budget";
import CategoryBars from "@/app/components/CategoryBars";
import EditablePurchases, {
  type EditablePurchaseRow,
} from "@/app/components/EditablePurchases";
import BackupRestore from "@/app/components/BackupRestore";
import VersionBar from "@/app/components/VersionBar";

// Reads are per-request against the DB — never at build time.
export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Shift a "YYYY-MM" key by whole months (delta may be negative). */
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}`;
}

/** Format a "YYYY-MM-DD" cycle boundary as e.g. "25 Jun" (parsed as UTC to avoid TZ drift). */
function formatCycleDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(`${iso}T00:00:00Z`));
}

type Pace = {
  color: string;
  soft: string;
  label: string;
  note: string;
};

export default async function MonthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const currentKey = dubaiMonthKey(new Date());
  const selected = month && MONTH_RE.test(month) ? month : currentKey;
  const isCurrent = selected === currentKey;

  // Everything for the selected Dubai month, plus this month's budget (if any)
  // and the last-backed-up timestamp for the "Your data" card.
  const [purchases, thisBudget, settings] = await Promise.all([
    db.purchase.findMany({
      where: { monthKey: selected },
      orderBy: { purchasedAt: "desc" },
      include: { item: { include: { category: true } } },
    }),
    db.budget.findUnique({ where: { monthKey: selected } }),
    db.settings.findUnique({ where: { id: 1 }, select: { lastBackupAt: true } }),
  ]);
  const lastBackupAt = settings?.lastBackupAt?.toISOString() ?? null;

  const shelfSpentFils = purchases.reduce((s, p) => s + p.totalFils, 0);
  const importIds = [...new Set(purchases.map((p) => p.importId).filter((x): x is string => !!x))];
  const discountImports = importIds.length
    ? await db.receiptImport.findMany({ where: { id: { in: importIds } }, select: { discountFils: true } })
    : [];
  const discountsFils = discountImports.reduce((s, i) => s + i.discountFils, 0);
  const spentFils = Math.max(0, shelfSpentFils - discountsFils); // what was PAID; used everywhere below

  // If this month has no budget, fall back to displaying last month's amount as
  // a guide — but never auto-create a row for it.
  const prevBudget = thisBudget
    ? null
    : await db.budget.findUnique({ where: { monthKey: shiftMonth(selected, -1) } });
  const targetFils = thisBudget?.amountFils ?? prevBudget?.amountFils ?? null;
  const hasExplicitBudget = !!thisBudget;

  // Category breakdown: Purchase → Item → Category (null category → "Other").
  const byCat = new Map<string, number>();
  for (const p of purchases) {
    const name = p.item.category?.name ?? "Uncategorized";
    byCat.set(name, (byCat.get(name) ?? 0) + p.totalFils);
  }
  const catData = [...byCat].map(([name, fils]) => ({ name, fils }));

  // Serializable rows for the editable client list — plain JSON only.
  const purchaseRows: EditablePurchaseRow[] = purchases.map((p) => ({
    id: p.id,
    itemName: p.item.name,
    priceAed: String(aedFromFils(p.totalFils)),
    quantity: p.quantity,
    unit: p.unit,
    store: p.store,
    onOffer: p.onOffer,
    purchasedAt: dubaiToday(p.purchasedAt),
  }));

  // Pay-cycle range for the selected month (25th of prev month → 24th).
  const range = cycleRange(selected);
  const daysInCycle = range.days;

  // Pace — only computed when we have a target to divide by.
  let pace: Pace | null = null;
  if (targetFils && targetFils > 0) {
    let metric = spentFils / targetFils; // share of budget used
    let projectedFils = spentFils;
    if (isCurrent) {
      // Inclusive days from the cycle start to today (in Dubai), clamped so we
      // never divide by zero or project past the end of the cycle.
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const startMs = Date.parse(`${range.start}T00:00:00Z`);
      const todayMs = Date.parse(`${dubaiToday(new Date())}T00:00:00Z`);
      const rawElapsed = Math.round((todayMs - startMs) / MS_PER_DAY) + 1;
      const daysElapsed = Math.min(Math.max(rawElapsed, 1), daysInCycle);
      projectedFils = Math.round((spentFils / daysElapsed) * daysInCycle);
      metric = projectedFils / targetFils;
    }

    if (metric <= 1.0) {
      pace = {
        color: "var(--green)",
        soft: "var(--green-soft)",
        label: isCurrent ? "On track" : "Under budget",
        note: isCurrent
          ? `Pacing to finish around ${formatAed(projectedFils)} — ${
              projectedFils <= targetFils ? "just under budget." : "near budget."
            }`
          : `Spent ${formatAed(spentFils)} of ${formatAed(targetFils)}.`,
      };
    } else if (metric <= 1.15) {
      pace = {
        color: "var(--amber)",
        soft: "var(--amber-soft)",
        label: "Watch spending",
        note: isCurrent
          ? `Pacing to finish around ${formatAed(projectedFils)} — a little over ${formatAed(
              targetFils,
            )}.`
          : `Spent ${formatAed(spentFils)} of ${formatAed(targetFils)} — a little over.`,
      };
    } else {
      pace = {
        color: "var(--red)",
        soft: "var(--red-soft)",
        label: "Over budget",
        note: isCurrent
          ? `Pacing to finish around ${formatAed(projectedFils)} — over ${formatAed(
              targetFils,
            )}.`
          : `Spent ${formatAed(spentFils)} of ${formatAed(targetFils)} — over budget.`,
      };
    }
  }

  const barPct =
    targetFils && targetFils > 0
      ? Math.min(spentFils / targetFils, 1) * 100
      : 0;

  // Budget editor — a bound server action so the plain form works without JS.
  async function submitBudget(formData: FormData) {
    "use server";
    const amount = String(formData.get("amount") ?? "").trim();
    if (amount) await setBudget(selected, amount);
  }

  return (
    <div className="rise">
      <h1 className="app-title">Month</h1>

      {/* Prev / label / next */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 14px" }}>
        <Link
          href={`/month?month=${shiftMonth(selected, -1)}`}
          aria-label="Previous month"
          style={navBtn}
        >
          ‹
        </Link>
        <div style={{ minWidth: 130, textAlign: "center" }}>
          <strong style={{ display: "block" }}>{monthKeyToLabel(selected)}</strong>
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            {formatCycleDay(range.start)} – {formatCycleDay(range.end)}
          </span>
        </div>
        <Link
          href={`/month?month=${shiftMonth(selected, 1)}`}
          aria-label="Next month"
          style={navBtn}
        >
          ›
        </Link>
      </div>

      {/* Gentle nudge to take a first backup — never a modal. */}
      {lastBackupAt == null && (
        <a
          href="#your-data"
          style={{
            display: "block",
            margin: "0 2px 14px",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px dashed var(--line)",
            background: "var(--amber-soft)",
            color: "var(--ink)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          🛟 Not backed up yet — Back up now
        </a>
      )}

      {/* Spend vs budget */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--ink-faint)",
            }}
          >
            Spent this month
          </span>
          {pace ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 10px",
                borderRadius: 999,
                background: pace.soft,
                color: pace.color,
              }}
            >
              {pace.label}
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-faint)" }}>
              No budget set
            </span>
          )}
        </div>

        <div
          className="mono"
          style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", margin: "6px 0 2px" }}
        >
          {formatAed(spentFils)}
          {targetFils != null && (
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-soft)" }}>
              {" "}
              / {aedFromFils(targetFils).toLocaleString("en-AE")}
            </span>
          )}
        </div>

        {discountsFils > 0 && (
          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "6px 0 0" }}>
            Items total {formatAed(shelfSpentFils)} at shelf price · you paid{" "}
            {formatAed(spentFils)} after {formatAed(discountsFils)} in receipt discounts.
          </p>
        )}

        {targetFils != null ? (
          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: "var(--line-soft)",
              overflow: "hidden",
              margin: "10px 0 6px",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${barPct}%`,
                borderRadius: 999,
                background: pace?.color ?? "var(--green)",
              }}
            />
          </div>
        ) : null}

        {pace ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>{pace.note}</p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "6px 0 0" }}>
            Set a monthly budget below to track your pace.
          </p>
        )}

        {!hasExplicitBudget && targetFils != null && (
          <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "8px 0 0" }}>
            Using last month&apos;s budget as a guide — set one for{" "}
            {monthKeyToLabel(selected)}.
          </p>
        )}
      </div>

      {/* Where it went */}
      <div className="card">
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--ink-faint)",
            marginBottom: 6,
          }}
        >
          Where it went
        </div>
        <CategoryBars data={catData} />
      </div>

      {/* Purchases — tap a row to edit or delete */}
      <div className="card">
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--ink-faint)",
            marginBottom: 4,
          }}
        >
          Purchases
        </div>
        <EditablePurchases
          rows={purchaseRows}
          monthLabel={monthKeyToLabel(selected)}
        />
      </div>

      {/* Set / change budget */}
      <form action={submitBudget} className="card">
        <label
          htmlFor="budget-amount"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-soft)",
            margin: "0 2px 6px",
          }}
        >
          {hasExplicitBudget ? "Change budget" : "Set budget"} for{" "}
          {monthKeyToLabel(selected)} (AED)
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            id="budget-amount"
            name="amount"
            inputMode="decimal"
            placeholder="1500"
            defaultValue={targetFils != null ? String(aedFromFils(targetFils)) : ""}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "13px 14px",
              border: "1px solid var(--line)",
              borderRadius: 12,
              fontSize: 16,
              background: "var(--card)",
              color: "var(--ink)",
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            style={{
              flex: "0 0 auto",
              border: 0,
              borderRadius: 14,
              padding: "13px 18px",
              fontSize: 16,
              fontWeight: 700,
              background: "var(--green)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </form>

      {/* Back up / restore your data */}
      <div className="card">
        <div className="card-kicker">Your data</div>
        <BackupRestore lastBackupAt={lastBackupAt} />
      </div>

      {/* Running version + one-tap update check */}
      <VersionBar />
    </div>
  );
}

const navBtn = {
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "6px 12px",
  background: "var(--card)",
  color: "var(--ink)",
  cursor: "pointer",
  textDecoration: "none",
  fontWeight: 700,
  lineHeight: 1,
} as const;
