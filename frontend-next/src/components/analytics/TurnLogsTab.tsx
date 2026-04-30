"use client";

import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { Fragment, useState } from "react";
import type { AnalyticsTurns, TurnRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import { absoluteTime, relativeTime } from "@/lib/time";
import { StatusChip } from "./StatusChip";

type SortKey = "created_at" | "latency_ms" | "total_tokens" | "cost_usd" | "step_count" | "tool_count";

/**
 * Turn Logs tab — paged, sortable, expandable table. Now surfaces the When /
 * User / Session columns so each row is independently identifiable; the
 * (verbose) Error type + detail columns were folded into the Status chip's
 * hover-tooltip and the expand row, which kept the table from being too wide
 * to scan.
 */
export function TurnLogsTab({
  data,
  loading,
  page,
  pageSize,
  sort,
  direction,
  onChangePage,
  onChangeSort,
  onPickUser,
  onPickThread,
}: {
  data: AnalyticsTurns | null;
  loading: boolean;
  page: number;
  pageSize: number;
  sort: SortKey;
  direction: "asc" | "desc";
  onChangePage: (p: number) => void;
  onChangeSort: (k: SortKey, d: "asc" | "desc") => void;
  onPickUser?: (userId: string) => void;
  onPickThread?: (row: TurnRow) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (!data && loading) return <div className="skeleton h-[400px] w-full rounded-[14px]" />;
  if (!data) return null;

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <section className="overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)]">
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-extrabold tracking-tight">Turn Logs</span>
          <span className="text-[11px] text-[var(--muted-2)]">
            {data.total.toLocaleString()} record{data.total === 1 ? "" : "s"}
          </span>
        </div>
        <Pager page={page} totalPages={totalPages} onChange={onChangePage} />
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-[12.5px]">
          <thead className="bg-[var(--hover-soft)] text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
            <tr>
              <SortableTh
                label="When"
                k="created_at"
                sort={sort}
                direction={direction}
                onChangeSort={onChangeSort}
              />
              <Th>User</Th>
              <Th>Session</Th>
              <Th>Question</Th>
              <Th>Answer</Th>
              <Th>Status</Th>
              <SortableTh
                label="Duration"
                k="latency_ms"
                sort={sort}
                direction={direction}
                onChangeSort={onChangeSort}
                align="right"
              />
              <SortableTh
                label="Tokens"
                k="total_tokens"
                sort={sort}
                direction={direction}
                onChangeSort={onChangeSort}
                align="right"
              />
              <SortableTh
                label="Cost"
                k="cost_usd"
                sort={sort}
                direction={direction}
                onChangeSort={onChangeSort}
                align="right"
              />
              <Th align="right">Feedback</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--stroke)]">
            {data.rows.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className="cursor-pointer hover:bg-[var(--hover-soft)]"
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))
                  }
                >
                  <Td>
                    <span
                      className="num text-[12px] text-[var(--muted)]"
                      title={absoluteTime(r.created_at)}
                    >
                      {relativeTime(r.created_at)}
                    </span>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickUser?.(r.user_id);
                      }}
                      className="font-mono text-[12px] text-[var(--muted)] hover:text-[var(--accent)]"
                      title={`Filter to ${r.user_id}`}
                    >
                      {r.user_id}
                    </button>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickThread?.(r);
                      }}
                      className="font-mono text-[12px] text-[var(--muted)] hover:text-[var(--accent)]"
                      title={`Open ${r.thread_id}`}
                    >
                      {r.thread_id.slice(0, 8)}…
                    </button>
                  </Td>
                  <Td className="max-w-[260px]">
                    <Truncated text={r.user_message} expanded={!!expanded[r.id]} />
                  </Td>
                  <Td className="max-w-[260px]">
                    <Truncated text={r.assistant_message} expanded={!!expanded[r.id]} />
                  </Td>
                  <Td>
                    <StatusChip
                      status={r.status}
                      title={
                        r.error_type
                          ? `${r.error_type}${r.error_detail ? ` — ${r.error_detail}` : ""}`
                          : undefined
                      }
                    />
                  </Td>
                  <Td align="right">
                    <DurationCell row={r} />
                  </Td>
                  <Td align="right" className="num">
                    {r.total_tokens?.toLocaleString() ?? "—"}
                  </Td>
                  <Td align="right" className="num">
                    {r.cost_usd != null ? `$${r.cost_usd.toFixed(4)}` : "—"}
                  </Td>
                  <Td align="right">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5 text-[var(--gain)]">
                        <ThumbsUp size={11} />
                        <span className="num text-[11.5px]">{r.likes}</span>
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[var(--loss)]">
                        <ThumbsDown size={11} />
                        <span className="num text-[11.5px]">{r.dislikes}</span>
                      </span>
                    </span>
                  </Td>
                </tr>
                {expanded[r.id] && (
                  <tr className="bg-[var(--hover-soft)]/60">
                    <td colSpan={10} className="px-4 py-3">
                      <ExpandedDetail row={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-[var(--muted-2)]">
                  No turns match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DurationCell({ row }: { row: TurnRow }) {
  const total = row.latency_ms ? `${(row.latency_ms / 1000).toFixed(2)}s` : "—";
  const llm = row.llm_ms != null ? `${(row.llm_ms / 1000).toFixed(1)}s` : null;
  const exec = row.exec_ms != null ? `${(row.exec_ms / 1000).toFixed(1)}s` : null;
  return (
    <div className="flex flex-col items-end">
      <span className="num text-[12.5px] font-semibold">{total}</span>
      {(llm || exec) && (
        <span className="num text-[10.5px] text-[var(--muted-3)]">
          LLM {llm ?? "—"} · Exec {exec ?? "—"}
        </span>
      )}
    </div>
  );
}

function Truncated({ text, expanded }: { text: string; expanded: boolean }) {
  if (!text) return <span className="text-[var(--muted-3)]">—</span>;
  return (
    <span className={cn("block whitespace-pre-wrap", !expanded && "line-clamp-2")}>
      {text}
    </span>
  );
}

function ExpandedDetail({ row }: { row: TurnRow }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] p-3">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
          User
        </div>
        <pre className="mt-1 whitespace-pre-wrap break-words text-[13px] text-[var(--text)]">
          {row.user_message}
        </pre>
      </div>
      <div className="rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] p-3">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--muted-2)]">
          Assistant
        </div>
        <pre className="mt-1 whitespace-pre-wrap break-words text-[13px] text-[var(--text)]">
          {row.assistant_message || "(empty)"}
        </pre>
      </div>
      {(row.error_type || row.error_detail) && (
        <div className="md:col-span-2 rounded-[10px] border border-[var(--loss)]/40 bg-[var(--loss-soft)] p-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--loss)]">
            Error{row.error_type ? ` · ${row.error_type}` : ""}
          </div>
          {row.error_detail && (
            <pre className="mt-1 whitespace-pre-wrap break-words text-[13px] text-[var(--text)]">
              {row.error_detail}
            </pre>
          )}
        </div>
      )}
      <div className="md:col-span-2">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
          <Meta label="Thread">{row.thread_id}</Meta>
          <Meta label="User">{row.user_id}</Meta>
          <Meta label="Model">{row.model}</Meta>
          <Meta label="When">{absoluteTime(row.created_at) || "—"}</Meta>
          <Meta label="Steps">
            {row.step_count != null ? `${row.step_count}` : "—"}
            {row.tool_count != null && (
              <span className="ml-1 text-[var(--muted-3)]">· {row.tool_count} tools</span>
            )}
          </Meta>
          <Meta label="Prompt tokens">{row.prompt_tokens?.toLocaleString() ?? "—"}</Meta>
          <Meta label="Completion tokens">
            {row.completion_tokens?.toLocaleString() ?? "—"}
          </Meta>
          <Meta label="Total tokens">{row.total_tokens?.toLocaleString() ?? "—"}</Meta>
          <Meta label="Cost">{row.cost_usd != null ? `$${row.cost_usd.toFixed(6)}` : "—"}</Meta>
        </dl>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--muted-2)]">
        {label}
      </dt>
      <dd className="font-mono text-[12px] text-[var(--text)]">{children}</dd>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn("px-3 py-2 font-bold", align === "right" && "text-right")}>
      {children}
    </th>
  );
}

function SortableTh({
  label,
  k,
  sort,
  direction,
  onChangeSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  direction: "asc" | "desc";
  onChangeSort: (k: SortKey, d: "asc" | "desc") => void;
  align?: "left" | "right";
}) {
  const active = sort === k;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        "cursor-pointer select-none px-3 py-2 font-bold transition-colors hover:text-[var(--text)]",
        align === "right" && "text-right",
        active ? "text-[var(--text)]" : ""
      )}
      onClick={() => onChangeSort(k, active && direction === "desc" ? "asc" : "desc")}
    >
      {label}
      <span
        className={cn(
          "ml-1 text-[9px] transition-colors",
          active ? "text-[var(--accent)]" : "text-[var(--muted-3)]"
        )}
        aria-hidden
      >
        {active ? (direction === "desc" ? "▼" : "▲") : "↕"}
      </span>
    </th>
  );
}

function Td({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={cn("px-3 py-2.5 align-top", align === "right" && "text-right", className)}>
      {children}
    </td>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] px-1.5 py-1 text-[12px]">
      <button
        type="button"
        aria-label="Previous page"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--hover-stronger)] hover:text-[var(--text)] disabled:opacity-30"
      >
        <ChevronLeft size={13} />
      </button>
      <span className="num min-w-[60px] text-center text-[var(--text)]">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        aria-label="Next page"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="grid h-6 w-6 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--hover-stronger)] hover:text-[var(--text)] disabled:opacity-30"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}
