"use client";

import { ChevronLeft, ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { Fragment, useState } from "react";
import type { AnalyticsFeedback, FeedbackItem } from "@/lib/api";
import { cn } from "@/lib/cn";
import { absoluteTime, relativeTime } from "@/lib/time";

/**
 * Feedback tab — flat list of every feedback row joined with the original
 * question + answer it was given on. Mirrors the dense, paginated style of
 * the Turn Logs tab so reviewers can read a comment, see the conversation
 * that prompted it, and click through to the user filter for context.
 *
 * Columns: When (relative + absolute tooltip) · User · Kind chip · Comment
 * (truncated, full text in expand row) · Question (truncated) · Thread.
 *
 * Click a row to expand the original question + answer below it.
 */
export function FeedbackTab({
  data,
  loading: _loading,
  page,
  pageSize,
  kind,
  onChangePage,
  onChangeKind,
  onPickUser,
  onPickThread,
}: {
  data: AnalyticsFeedback | null;
  loading: boolean;
  page: number;
  pageSize: number;
  kind: "all" | "like" | "dislike";
  onChangePage: (p: number) => void;
  onChangeKind: (k: "all" | "like" | "dislike") => void;
  onPickUser?: (userId: string) => void;
  onPickThread?: (threadId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // `data === null` means the fetch is in flight — show the skeleton.
  if (!data) return <div className="skeleton h-[400px] w-full rounded-[14px]" />;

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <section className="flex flex-col gap-3">
      {/* Filter strip + pager. Kept compact so it doesn't push the table down. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[10px] border border-[var(--stroke)] bg-[var(--bg-1)] p-0.5">
          {(["all", "like", "dislike"] as const).map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onChangeKind(k)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-semibold transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
                )}
              >
                {k === "like" && <ThumbsUp size={12} />}
                {k === "dislike" && <ThumbsDown size={12} />}
                {k === "all" ? "All" : k === "like" ? "Liked" : "Disliked"}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[var(--muted-2)]">
          <span className="num">
            {data.total.toLocaleString()} feedback{data.total === 1 ? "" : "s"}
          </span>
          <span aria-hidden>·</span>
          <span>
            Page <span className="num">{data.page}</span> of{" "}
            <span className="num">{totalPages}</span>
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead className="bg-[var(--hover-soft)] text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
              <tr>
                <Th>When</Th>
                <Th>User</Th>
                <Th>Kind</Th>
                <Th>Comment</Th>
                <Th>Question</Th>
                <Th>Thread</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stroke)]">
              {data.rows.map((r) => {
                const open = expanded[r.id] ?? false;
                return (
                  <Fragment key={r.id}>
                    <tr
                      className="cursor-pointer hover:bg-[var(--hover-soft)]"
                      onClick={() =>
                        setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))
                      }
                    >
                      <Td title={absoluteTime(r.created_at)} className="text-[var(--muted-2)]">
                        {relativeTime(r.created_at)}
                      </Td>
                      <Td className="font-mono">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPickUser?.(r.user_id);
                          }}
                          className="hover:text-[var(--accent)] hover:underline"
                        >
                          {r.user_id}
                        </button>
                      </Td>
                      <Td>
                        <KindChip kind={r.kind} />
                      </Td>
                      <Td className="max-w-[320px]">
                        <span className="line-clamp-1 text-[var(--text)]">
                          {r.comment || (
                            <span className="text-[var(--muted-3)]">
                              (no comment)
                            </span>
                          )}
                        </span>
                      </Td>
                      <Td className="max-w-[300px]">
                        <span className="line-clamp-1 text-[var(--muted)]">
                          {r.user_message || "—"}
                        </span>
                      </Td>
                      <Td className="font-mono">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPickThread?.(r.thread_id);
                          }}
                          className="hover:text-[var(--accent)] hover:underline"
                          title={r.thread_id}
                        >
                          {r.thread_id.slice(0, 8)}…
                        </button>
                      </Td>
                    </tr>
                    {open && (
                      <tr className="bg-[var(--bg-1)]">
                        <td colSpan={6} className="px-4 py-3">
                          <ExpandedRow item={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[var(--muted-2)]"
                  >
                    No feedback in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pager */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChangePage(Math.max(1, page - 1))}
          className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[var(--stroke)] px-2 text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--hover-soft)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={13} />
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChangePage(Math.min(totalPages, page + 1))}
          className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[var(--stroke)] px-2 text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--hover-soft)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={13} />
        </button>
      </div>
    </section>
  );
}

function KindChip({ kind }: { kind: "like" | "dislike" }) {
  const liked = kind === "like";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold",
        liked
          ? "bg-[var(--gain)]/15 text-[var(--gain)]"
          : "bg-[var(--loss)]/15 text-[var(--loss)]"
      )}
    >
      {liked ? <ThumbsUp size={11} /> : <ThumbsDown size={11} />}
      {liked ? "Liked" : "Disliked"}
    </span>
  );
}

function ExpandedRow({ item }: { item: FeedbackItem }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Field label="Comment" empty="No comment was attached.">
        {item.comment}
      </Field>
      <Field
        label={`Original question · ${absoluteTime(item.interaction_created_at)}`}
        empty="—"
      >
        {item.user_message}
      </Field>
      <div className="lg:col-span-2">
        <Field label="Assistant answer" empty="—">
          {item.assistant_message}
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: string | null;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--stroke)] bg-[var(--glass)] px-3 py-2">
      <div className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted-2)]">
        {label}
      </div>
      <div className="mt-1 whitespace-pre-wrap break-words text-[12.5px] text-[var(--text)]">
        {children || (
          <span className="text-[var(--muted-3)]">{empty}</span>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-bold">{children}</th>;
}

function Td({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td title={title} className={cn("px-3 py-2.5 align-top", className)}>
      {children}
    </td>
  );
}
