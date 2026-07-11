import { formatAed } from "@/lib/money";

// Presentational (server component). Draws one labelled proportional bar per
// category — width is that category's share of the month's total spend, mirroring
// the "Where it went" card in docs/mockup.html.
const COLORS = [
  "var(--green)",
  "#3aa0ff",
  "#a78bfa",
  "#f79009",
  "#f472b6",
  "#12b76a",
  "#f0745b",
];

type Props = {
  data: { name: string; fils: number }[];
};

export default function CategoryBars({ data }: Props) {
  const total = data.reduce((s, c) => s + c.fils, 0);
  if (total <= 0) {
    return (
      <p style={{ margin: "4px 2px", fontSize: 13, color: "var(--ink-soft)" }}>
        No spending recorded this month yet.
      </p>
    );
  }

  const sorted = [...data].sort((a, b) => b.fils - a.fils);

  return (
    <div>
      {sorted.map((c, i) => {
        const pct = Math.round((c.fils / total) * 100);
        return (
          <div key={c.name} style={{ margin: "12px 0" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              <span>{c.name}</span>
              <span className="mono" style={{ color: "var(--ink-soft)" }}>
                {formatAed(c.fils)}
              </span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "var(--line-soft)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 999,
                  background: COLORS[i % COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
