"use client";

import type { AnalyticsTrends } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AreaChart } from "./charts/AreaChart";
import { BarChart } from "./charts/BarChart";
import { LineChart } from "./charts/LineChart";
import { ChartEmpty, formatCompact } from "./charts/ChartTooltip";

/**
 * Trend Analysis tab — Daily/Weekly/Monthly toggle plus a 2-column grid of
 * compact charts that vary in *type* (bar / line / area) so they don't all
 * look the same. Heights are deliberately tight to kill the wasted vertical
 * space the previous design had.
 */
export function TrendsTab({
  data,
  loading,
  granularity,
  onChangeGranularity,
}: {
  data: AnalyticsTrends | null;
  loading: boolean;
  granularity: "daily" | "weekly" | "monthly";
  onChangeGranularity: (g: "daily" | "weekly" | "monthly") => void;
}) {
  if (!data && loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton h-9 w-full rounded-[10px]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="skeleton h-[260px] rounded-[14px]" />
          <div className="skeleton h-[260px] rounded-[14px]" />
          <div className="skeleton h-[260px] rounded-[14px]" />
          <div className="skeleton h-[260px] rounded-[14px]" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const points = data.points;
  const hasData = points.length > 0;

  // Quick aggregates for the panel sub-titles
  const totalQueries = points.reduce((acc, p) => acc + (p.queries ?? 0), 0);
  const totalCost = points.reduce((acc, p) => acc + (p.total_cost_usd ?? 0), 0);
  const avgLatencySec = (() => {
    const arr = points.map((p) => p.avg_latency_ms).filter((v): v is number => v != null);
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length / 1000;
  })();
  const avgTokens = (() => {
    const arr = points.map((p) => p.avg_tokens).filter((v): v is number => v != null);
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-extrabold tracking-tight">Trend Analysis</h2>
          <span className="text-[11.5px] text-[var(--muted-2)]">
            {points.length} {granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month"}
            {points.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] p-1">
          {(["daily", "weekly", "monthly"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChangeGranularity(g)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-semibold capitalize transition-colors",
                granularity === g
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* 2-col grid of compact charts. Variety: bar / line / area / area. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Queries Volume"
          sub={`${totalQueries.toLocaleString()} total`}
        >
          {!hasData ? (
            <ChartEmpty />
          ) : (
            <div className="px-3 pb-3 pt-1">
              <BarChart
                data={points.map((p) => ({ label: p.bucket, value: p.queries ?? 0 }))}
                yLabel="Queries"
                color="var(--chart-1)"
                height={180}
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Avg Response Time"
          sub={avgLatencySec != null ? `~${avgLatencySec.toFixed(2)}s avg` : undefined}
        >
          {!hasData ? (
            <ChartEmpty />
          ) : (
            <div className="px-3 pb-3 pt-1">
              <LineChart
                data={points.map((p) => ({
                  label: p.bucket,
                  value: p.avg_latency_ms ? p.avg_latency_ms / 1000 : 0,
                }))}
                yLabel="Seconds"
                stroke="var(--chart-2)"
                format={(v) => `${formatCompact(v)}s`}
                height={180}
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Avg Tokens / Query"
          sub={avgTokens != null ? `~${formatCompact(avgTokens)} avg` : undefined}
        >
          {!hasData ? (
            <ChartEmpty />
          ) : (
            <div className="px-3 pb-3 pt-1">
              <AreaChart
                data={points.map((p) => ({ label: p.bucket, value: p.avg_tokens ?? 0 }))}
                yLabel="Tokens"
                stroke="var(--chart-6)"
                height={180}
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Cost per Bucket"
          sub={`$${totalCost.toFixed(2)} total`}
        >
          {!hasData ? (
            <ChartEmpty />
          ) : (
            <div className="px-3 pb-3 pt-1">
              <BarChart
                data={points.map((p) => ({ label: p.bucket, value: p.total_cost_usd ?? 0 }))}
                yLabel="Cost ($)"
                color="var(--chart-3)"
                format={(v) => `$${v.toFixed(2)}`}
                height={180}
              />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)]">
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--stroke)] px-4 py-2.5">
        <span className="text-[13px] font-extrabold tracking-tight">{title}</span>
        {sub && <span className="text-[11px] text-[var(--muted-2)]">{sub}</span>}
      </header>
      {children}
    </section>
  );
}
