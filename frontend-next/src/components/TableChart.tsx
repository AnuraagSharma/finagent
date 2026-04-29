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
                  "border-b border-[var(--stroke)] last:border-b-0 transition-colors",
                  "hover:bg-[var(--accent-soft)]/40"
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

      {/* Chart (only if applicable) */}
      {showChart && (
        <div className="border-t border-[var(--stroke)] px-3 py-4">
          <div className="h-[240px] w-full">
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                margin={{ top: 6, right: 8, left: -10, bottom: 4 }}
                barCategoryGap="22%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--stroke)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-2)"
                  tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--stroke)" }}
                />
                <YAxis
                  stroke="var(--muted-2)"
                  tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--stroke)" }}
                />
                <ReTooltip
                  cursor={{ fill: "var(--accent-soft)" }}
                  contentStyle={{
                    background: "var(--glass-2)",
                    border: "1px solid var(--stroke-2)",
                    borderRadius: 10,
                    color: "var(--text)",
                    fontSize: 12,
                    boxShadow: "var(--shadow-2)",
                  }}
                  labelStyle={{ color: "var(--muted)", fontWeight: 600 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.value >= 0 ? "var(--gain)" : "var(--loss)"}
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
