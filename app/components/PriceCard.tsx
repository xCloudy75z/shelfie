import { formatAed } from "@/lib/money";
import type { Stats } from "@/lib/price-stats";

// Presentational only (server component). Renders the item's price story exactly
// like the Prices card in docs/mockup.html: header + a 2×2 stat grid of
// Last paid / Best ever / Average / Highest, all in the mono tabular font.
type Props = {
  name: string;
  emoji?: string;
  stats: Stats;
};

function dubaiDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

const statBox = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 2,
};
const statKey = {
  fontSize: 11,
  color: "var(--ink-faint)",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};
const statVal = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: "-0.01em",
};
const statSub = { fontSize: 12, color: "var(--ink-soft)" };

export default function PriceCard({ name, emoji = "🛒", stats }: Props) {
  // avg/benchmark can be 0 when there are no in-window non-offer buys yet — show
  // an em dash rather than a misleading "AED 0.00".
  const avgDisplay = stats.avgFils > 0 ? formatAed(stats.avgFils) : "—";

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--green-soft)",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            flex: "none",
          }}
          aria-hidden
        >
          {emoji}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{name}</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            Bought {stats.count} {stats.count === 1 ? "time" : "times"} · usually{" "}
            {stats.lastStore}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={statBox}>
          <span style={statKey}>Last paid</span>
          <span className="mono" style={statVal}>
            {formatAed(stats.lastFils)}
          </span>
          <span style={statSub}>{dubaiDate(stats.lastDate)}</span>
        </div>
        <div style={statBox}>
          <span style={{ ...statKey, color: "var(--green-strong)" }}>Best ever</span>
          <span className="mono" style={{ ...statVal, color: "var(--green-strong)" }}>
            {formatAed(stats.bestFils)}
          </span>
          <span style={statSub}>all-time low</span>
        </div>
        <div style={statBox}>
          <span style={statKey}>Average</span>
          <span className="mono" style={statVal}>
            {avgDisplay}
          </span>
        </div>
        <div style={statBox}>
          <span style={statKey}>Highest</span>
          <span className="mono" style={statVal}>
            {formatAed(stats.highestFils)}
          </span>
        </div>
      </div>

      {!stats.enoughToJudge && (
        <p style={{ margin: "14px 2px 0", fontSize: 13, color: "var(--ink-soft)" }}>
          Not enough recent prices to judge yet — showing what we have so far.
        </p>
      )}
    </div>
  );
}
