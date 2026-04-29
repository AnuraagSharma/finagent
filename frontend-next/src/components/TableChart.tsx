"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/cn";

export type ParsedTable = {
  headers: string[];
  aligns: ("left" | "right" | "center")[];
  rows: string[][];
};

/* Try to parse a number out of "21.301", "$21.30bn", "+19.6%", "-8.7%". */
function parseNumeric(s: string): number | null {
  if (s == null) return null;
  const m = String(s).trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", "."));
  if (!isFinite(n)) return null;
  // If the original ends with %, keep raw value (caller may interpret).
  return n;
}

function formatChartValue(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs > 0 && abs < 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function ChartTooltipCard({
  active,
  payload,
  label,
  valueColumnLabel,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: string | number;
  valueColumnLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const v =
    typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : Number.NaN;

  const labelText = label != null && String(label).length ? String(label) : "—";

  return (
    <div
      className={cn(
        "chart-tooltip-root min-w-[156px] max-w-[min(100vw-2rem,300px)] rounded-xl px-3.5 py-3 text-left",
        "border border-[var(--stroke-accent)] bg-[var(--glass-2)]/98 text-[var(--text)]",
        "shadow-[0_16px_48px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.1)]",
        "ring-1 ring-white/[0.12] backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--glass-2)]/90"
      )}
      style={{ backdropFilter: "saturate(1.15) blur(14px)" }}
    >
      <div className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[var(--muted-2)]">
        Series
      </div>
      <div className="mb-2.5 mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--text)]">
        {labelText}
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--stroke-2)] to-transparent" />
      <div className="mt-2.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
        {valueColumnLabel}
      </div>
      <div className="num mt-1 font-mono text-[18px] font-bold tabular-nums tracking-tight text-[var(--text)]">
        {Number.isFinite(v) ? formatChartValue(v) : "—"}
      </div>
    </div>
  );
}

function detectFirstNumericColumn(table: ParsedTable): number | null {
  for (let c = 0; c < table.headers.length; c++) {
    let hits = 0;
    for (const row of table.rows) {
      const v = parseNumeric(row[c] ?? "");
      if (v !== null) hits += 1;
    }
    if (hits >= Math.max(2, Math.floor(table.rows.length * 0.6))) return c;
  }
  return null;
}

export function TableChart({ table }: { table: ParsedTable }) {
  const numericCol = useMemo(() => detectFirstNumericColumn(table), [table]);
  const labelCol = useMemo(() => {
    for (let c = 0; c < table.headers.length; c++) {
      if (c !== numericCol) return c;
    }
    return 0;
  }, [table, numericCol]);

  const chartData = useMemo(() => {
    if (numericCol === null) return [];
    return table.rows.map((row) => ({
      label: row[labelCol] || "",
      value: parseNumeric(row[numericCol]) ?? 0,
    }));
  }, [table, numericCol, labelCol]);

  const showChart = numericCol !== null && chartData.length >= 2;

  return (
    <div className="my-3 overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--panel)]/50 ring-inset-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--stroke)] bg-white/[0.02] px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-2)]">
          Table · {table.rows.length} row{table.rows.length === 1 ? "" : "s"}
        </div>
        {showChart && (
          <div className="text-[11px] text-[var(--muted-3)]">
            <span className="font-bold text-[var(--muted)]">
              {table.headers[numericCol!]}
            </span>{" "}
            by {table.headers[labelCol]}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-[var(--stroke)] bg-white/[0.015]">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]",
                    table.aligns[i] === "right" && "text-right",
                    table.aligns[i] === "center" && "text-center",
                    table.aligns[i] === "left" && "text-left"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr
                key={ri}
                className={cn(
                  "border-b border-[var(--stroke)] last:border-b-0 transition-[background-color,box-shadow] duration-150 ease-out",
                  "hover:bg-[var(--accent-soft)]/50 hover:shadow-[inset_4px_0_0_var(--accent)]"
                )}
              >
                {row.map((cell, ci) => {
                  const isPercent = /[-+]?\d+(?:\.\d+)?%/.test(cell.trim());
                  const numeric = parseNumeric(cell);
                  const positive = numeric !== null && numeric > 0;
                  const negative = numeric !== null && numeric < 0;
                  return (
                    <td
                      key={ci}
                      className={cn(
                        "px-3 py-2",
                        table.aligns[ci] === "right" && "text-right",
                        table.aligns[ci] === "center" && "text-center",
                        table.aligns[ci] === "left" && "text-left",
                        ci === numericCol && "num font-mono font-semibold",
                        isPercent && positive && "delta-up font-semibold",
                        isPercent && negative && "delta-down font-semibold"
                      )}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart — hover + tooltip tuned for readability on dark/light */}
      {showChart && (
        <div className="relative border-t border-[var(--stroke)] bg-white/[0.02] px-3 py-4">
          <div className="pointer-events-none absolute inset-x-3 top-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-3)]">
            Hover bars for detail
          </div>
          <div className="mt-7 h-[240px] w-full [&_.recharts-tooltip-wrapper]:!z-[80] [&_.recharts-tooltip-wrapper]:!outline-none">
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                margin={{ top: 18, right: 10, left: -6, bottom: 6 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  strokeDasharray="3 6"
                  stroke="var(--stroke-2)"
                  strokeOpacity={0.85}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                  }}
                  stroke="var(--stroke-2)"
                  tickLine={{ stroke: "var(--stroke-2)" }}
                  axisLine={{ stroke: "var(--stroke)" }}
                  interval={0}
                  tickMargin={8}
                  tickFormatter={(s) =>
                    String(s).length > 14 ? `${String(s).slice(0, 12)}…` : String(s)
                  }
                />
                <YAxis
                  stroke="var(--stroke-2)"
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--stroke)" }}
                  width={48}
                  tickMargin={6}
                />
                <ReTooltip
                  offset={14}
                  cursor={{
                    stroke: "var(--accent)",
                    strokeWidth: 1.5,
                    strokeOpacity: 0.85,
                    fill: "rgba(52, 211, 153, 0.12)",
                  }}
                  wrapperStyle={{ outline: "none", zIndex: 80 }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  animationDuration={180}
                  content={(tooltipProps) => (
                    <ChartTooltipCard
                      active={tooltipProps.active}
                      payload={tooltipProps.payload}
                      label={tooltipProps.label}
                      valueColumnLabel={table.headers[numericCol]}
                    />
                  )}
                />
                <Bar
                  dataKey="value"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={52}
                  animationDuration={380}
                  activeBar={{
                    stroke: "var(--text)",
                    strokeWidth: 2.5,
                    strokeOpacity: 0.94,
                  }}
                >
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.value >= 0 ? "var(--gain)" : "var(--loss)"}
                      className="transition-[opacity] duration-150"
                      fillOpacity={0.94}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
