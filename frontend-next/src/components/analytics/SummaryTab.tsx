"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { AnalyticsSummary, AnalyticsUsers } from "@/lib/api";
import { KpiCard } from "./KpiCard";
import { DonutChart } from "./charts/DonutChart";
import { LineChart } from "./charts/LineChart";
import { ChartEmpty, formatCompact } from "./charts/ChartTooltip";

/**
 * Summary tab — top-of-funnel KPI strip plus four "at a glance" panels:
 * Query Status Mix, Latency Composition, Feedback Mix, and a Top 5 Users
 * leaderboard. The Response Time Trend chart is preserved at the bottom.
 *
 * The "Top Recurring Errors" list was removed in favor of the donuts; raw
 * error rows still live in the Turn Logs tab.
 */
export function SummaryTab({
  data,
  users,
  loading,
  onPickUser,
}: {
  data: AnalyticsSummary | null;
  users: AnalyticsUsers | null;
  loading: boolean;
  onPickUser?: (userId: string) => void;
}) {
  if (!data && loading) return <SkeletonGrid />;
  if (!data) return <Empty />;

  const successPct = `${(data.success_rate * 100).toFixed(1)}%`;
  const tokens = data.avg_tokens
    ? Math.round(data.avg_tokens).toLocaleString()
    : "—";
  const totalCost = data.total_cost_usd
    ? `$${data.total_cost_usd.toFixed(2)}`
    : "$0.00";
  const avgCost = data.avg_cost_usd
    ? `Avg $${data.avg_cost_usd.toFixed(4)} / query`
    : "no queries yet";
  const avgLatencySec =
    data.avg_latency_ms != null ? (data.avg_latency_ms / 1000).toFixed(2) : null;
  const llmSec = data.avg_llm_ms != null ? (data.avg_llm_ms / 1000).toFixed(1) : null;
  const execSec = data.avg_exec_ms != null ? (data.avg_exec_ms / 1000).toFixed(1) : null;
  const blended =
    data.blended_per_million != null
      ? `$${data.blended_per_million.toFixed(2)} / 1M tokens (blended)`
      : null;

  // ---- Derived chart data ----
  const totalQ = Math.max(0, data.total_queries);
  const hardE = Math.max(0, data.hard_errors);
  const softE = Math.max(0, data.soft_errors);
  const successQ = Math.max(0, totalQ - hardE - softE);

  const statusSlices = [
    { label: "Success", value: successQ, color: "var(--gain)" },
    { label: "Soft errors", value: softE, color: "var(--warn)" },
    { label: "Hard errors", value: hardE, color: "var(--loss)" },
  ];

  const llmMs = Math.max(0, data.avg_llm_ms ?? 0);
  const execMs = Math.max(0, data.avg_exec_ms ?? 0);
  const otherMs = Math.max(0, (data.avg_latency_ms ?? 0) - llmMs - execMs);
  const latencySlices = [
    { label: "LLM time", value: llmMs, color: "var(--ai)" },
    { label: "Tool / exec", value: execMs, color: "var(--accent)" },
    { label: "Other", value: otherMs, color: "var(--neutral)" },
  ];

  // Feedback mix — derived from the Users payload so it follows active filters.
  const totalLikes = users?.users.reduce((acc, u) => acc + u.likes, 0) ?? 0;
  const totalDislikes = users?.users.reduce((acc, u) => acc + u.dislikes, 0) ?? 0;
  const noFeedback = Math.max(0, totalQ - totalLikes - totalDislikes);
  const feedbackSlices = [
    { label: "Liked", value: totalLikes, color: "var(--gain)" },
    { label: "Disliked", value: totalDislikes, color: "var(--loss)" },
    { label: "No feedback", value: noFeedback, color: "var(--neutral)" },
  ];

  // Top 5 by question count — only computed when users data is present.
  // (Cheap enough at this size to avoid a `useMemo` after early returns,
  // which would violate the rules of hooks.)
  const topUsers = users
    ? [...users.users].sort((a, b) => b.questions - a.questions).slice(0, 5)
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total Queries"
          value={data.total_queries.toLocaleString()}
          sub={`${data.sessions} sessions`}
        />
        <KpiCard
          label="Unique Users"
          value={data.unique_users.toLocaleString()}
          sub={`${data.sessions} sessions`}
        />
        <KpiCard
          label="Success Rate"
          value={<span className="text-[var(--gain)]">{successPct}</span>}
          sub={`${data.hard_errors} hard / ${data.soft_errors} soft errors`}
          tone={data.hard_errors === 0 && data.soft_errors === 0 ? "positive" : undefined}
          accent
        />
        <KpiCard label="Total Cost" value={totalCost} sub={avgCost} accent />
        <KpiCard
          label="Avg Response Time"
          value={avgLatencySec ? `${avgLatencySec}s` : "—"}
          sub={
            llmSec || execSec
              ? `LLM ~${llmSec ?? "—"}s · Exec ~${execSec ?? "—"}s`
              : "no latency data yet"
          }
        />
        <KpiCard
          label="Avg Tokens"
          value={tokens}
          sub={blended || "no token data yet"}
        />
      </div>

      {/* Donut row 1: Status Mix + Latency Composition */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Query Status Mix">
          {totalQ === 0 ? (
            <ChartEmpty />
          ) : (
            <div className="flex items-center justify-center px-4 py-4">
              <DonutChart
                slices={statusSlices}
                centerLabel={successPct}
                centerSub="success"
                size={172}
                thickness={22}
                legend="side"
              />
            </div>
          )}
        </Panel>

        <Panel title="Latency Composition">
          {data.avg_latency_ms == null ? (
            <ChartEmpty message="No latency data yet" />
          ) : (
            <div className="flex items-center justify-center px-4 py-4">
              <DonutChart
                slices={latencySlices}
                centerLabel={avgLatencySec ? `${avgLatencySec}s` : "—"}
                centerSub="avg total"
                size={172}
                thickness={22}
                legend="side"
                format={(v) => `${(v / 1000).toFixed(2)}s`}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* Donut row 2: Feedback + Top Users */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Feedback Mix">
          {totalQ === 0 ? (
            <ChartEmpty />
          ) : (
            <div className="flex items-center justify-center px-4 py-4">
              <DonutChart
                slices={feedbackSlices}
                centerLabel={
                  <span className="flex items-center gap-1.5 text-[18px]">
                    <ThumbsUp size={14} className="text-[var(--gain)]" />
                    {totalLikes}
                    <span className="mx-1 text-[var(--muted-3)]">·</span>
                    <ThumbsDown size={14} className="text-[var(--loss)]" />
                    {totalDislikes}
                  </span>
                }
                centerSub="signals"
                size={172}
                thickness={22}
                legend="side"
              />
            </div>
          )}
        </Panel>

        <Panel title="Top 5 Users">
          {topUsers.length === 0 ? (
            <ChartEmpty message="No users in this window" />
          ) : (
            <ul className="flex flex-col gap-2.5 px-4 py-4">
              {topUsers.map((u, i) => {
                const max = topUsers[0].questions || 1;
                const pct = Math.min(100, (u.questions / max) * 100);
                return (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      onClick={() => onPickUser?.(u.user_id)}
                      className="group flex w-full flex-col gap-1.5 rounded-[10px] border border-transparent px-2 py-1.5 text-left hover:border-[var(--stroke)] hover:bg-[var(--hover-soft)]"
                    >
                      <div className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="num shrink-0 text-[var(--muted-3)]">#{i + 1}</span>
                          <span className="truncate font-mono font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
                            {u.user_id}
                          </span>
                        </span>
                        <span className="num shrink-0 text-[12px] font-bold text-[var(--text)]">
                          {u.questions.toLocaleString()}
                        </span>
                      </div>
                      <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-[var(--hover-soft)]">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${pct}%`,
                            background:
                              "linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)",
                            boxShadow: "0 0 12px var(--accent-glow)",
                          }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Response time trend — compact, full width */}
      <Panel title="Response Time Trend">
        {data.response_time_trend.length === 0 ? (
          <ChartEmpty message="No data points yet" />
        ) : (
          <div className="px-4 py-3">
            <LineChart
              data={data.response_time_trend.map((p) => ({
                label: p.bucket,
                value: p.avg_latency_ms ? p.avg_latency_ms / 1000 : 0,
              }))}
              yLabel="Avg latency (s)"
              format={(v) => `${formatCompact(v)}s`}
              height={180}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)]">
      <header className="border-b border-[var(--stroke)] px-4 py-2.5 text-[13px] font-extrabold tracking-tight">
        {title}
      </header>
      {children}
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[100px] rounded-[14px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="skeleton h-[240px] rounded-[14px]" />
        <div className="skeleton h-[240px] rounded-[14px]" />
      </div>
      <div className="skeleton h-[220px] rounded-[14px]" />
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--stroke)] bg-[var(--glass)] px-6 py-20 text-center text-[var(--muted-2)]">
      <div className="text-[14px] font-semibold">No data in this window</div>
      <div className="mt-1 text-[12.5px]">Run a few chats to populate analytics.</div>
    </div>
  );
}
