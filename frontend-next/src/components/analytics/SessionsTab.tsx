"use client";

import type { AnalyticsSessions, SessionRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import { absoluteTime, relativeTime } from "@/lib/time";

/**
 * Sessions tab — table of threads (one row per `thread_id`) with aggregated turn count,
 * total cost, total duration, and first/last activity. Clicking a row opens the detail
 * drawer with the full transcript.
 */
export function SessionsTab({
  data,
  loading,
  onPick,
}: {
  data: AnalyticsSessions | null;
  loading: boolean;
  onPick: (row: SessionRow) => void;
}) {
  if (!data && loading) return <div className="skeleton h-[400px] w-full rounded-[14px]" />;
  if (!data) return null;

  return (
    <section className="overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)]">
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-extrabold tracking-tight">Sessions</span>
          <span className="text-[11px] text-[var(--muted-2)]">
            {data.total.toLocaleString()} thread{data.total === 1 ? "" : "s"}
          </span>
        </div>
        <span className="text-[11px] text-[var(--muted-2)]">
          Click a row to view the full transcript
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[12.5px]">
          <thead className="bg-[var(--hover-soft)] text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
            <tr>
              <Th>Thread</Th>
              <Th>User</Th>
              <Th>First message</Th>
              <Th align="right">Turns</Th>
              <Th align="right">Total cost</Th>
              <Th align="right">Total duration</Th>
              <Th>First active</Th>
              <Th>Last active</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--stroke)]">
            {data.rows.map((s) => (
              <tr
                key={s.thread_id}
                className="cursor-pointer hover:bg-[var(--hover-soft)]"
                onClick={() => onPick(s)}
              >
                <Td className="font-mono" title={s.thread_id}>
                  {s.thread_id.slice(0, 8)}…
                </Td>
                <Td className="font-mono">{s.user_id}</Td>
                <Td className="max-w-[260px]">
                  <span className="line-clamp-1 text-[var(--muted)]">
                    {s.first_message || "—"}
                  </span>
                </Td>
                <Td align="right" className="num">
                  {s.turns}
                </Td>
                <Td align="right" className="num">
                  ${s.total_cost_usd.toFixed(4)}
                </Td>
                <Td align="right" className="num">
                  {s.total_duration_ms
                    ? `${(s.total_duration_ms / 1000).toFixed(1)}s`
                    : "—"}
                </Td>
                <Td className="text-[var(--muted-2)]" title={absoluteTime(s.first_active)}>
                  {relativeTime(s.first_active)}
                </Td>
                <Td className="text-[var(--muted-2)]" title={absoluteTime(s.last_active)}>
                  {relativeTime(s.last_active)}
                </Td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted-2)]">
                  No sessions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn("px-3 py-2 font-bold", align === "right" && "text-right")}>
      {children}
    </th>
  );
}
function Td({
  children,
  align = "left",
  className,
  title,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={cn("px-3 py-2.5 align-top", align === "right" && "text-right", className)}
    >
      {children}
    </td>
  );
}
