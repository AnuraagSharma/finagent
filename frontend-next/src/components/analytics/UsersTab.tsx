"use client";

import { useMemo, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { AnalyticsUsers, UserActivityRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import { absoluteTime, relativeTime } from "@/lib/time";
import { KpiCard } from "./KpiCard";

type Mode = "questions" | "sessions" | "cost";

/**
 * Users tab — 4 highlight cards, an activity bar list with a Questions/Sessions/Cost
 * toggle, and a full users table at the bottom. Clicking a user filters the rest of
 * the dashboard to that user.
 */
export function UsersTab({
  data,
  loading,
  onPickUser,
}: {
  data: AnalyticsUsers | null;
  loading: boolean;
  onPickUser: (userId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("questions");

  if (!data && loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[100px] rounded-[14px]" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const sorted = [...data.users].sort((a, b) =>
    mode === "cost"
      ? b.cost_usd - a.cost_usd
      : mode === "sessions"
      ? b.sessions - a.sessions
      : b.questions - a.questions
  );
  const top = sorted.length > 0 ? modeValue(sorted[0], mode) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active Users"
          value={data.active_users.toLocaleString()}
          sub="with ≥ 1 question in window"
          accent
        />
        <KpiCard
          label="Top User"
          value={data.top_user || "—"}
          sub={`${data.top_user_questions} questions`}
        />
        <KpiCard
          label="Avg Questions / User"
          value={data.avg_questions_per_user.toFixed(1)}
          sub={`${data.total_questions} questions total`}
        />
        <KpiCard
          label="Power Users (>10 Q)"
          value={data.power_users.toString()}
          sub={
            data.active_users
              ? `${((data.power_users / data.active_users) * 100).toFixed(0)}% of active`
              : "0% of active"
          }
          tone="warn"
        />
      </div>

      <section className="overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--stroke)] px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-extrabold tracking-tight">User Activity</span>
            <span className="text-[11px] text-[var(--muted-2)]">{data.users.length} users</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] p-1">
            {(["questions", "sessions", "cost"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11.5px] font-semibold capitalize transition-colors",
                  mode === m
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-2.5 px-4 py-3">
          {sorted.slice(0, 12).map((u, i) => (
            <ActivityBar
              key={u.user_id}
              row={u}
              rank={i + 1}
              max={top}
              mode={mode}
              onClick={() => onPickUser(u.user_id)}
            />
          ))}
          {sorted.length === 0 && (
            <div className="py-6 text-center text-[13px] text-[var(--muted-2)]">
              No users in this window.
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-[var(--glass)]">
        <header className="flex items-center justify-between border-b border-[var(--stroke)] px-4 py-2.5">
          <span className="text-[13px] font-extrabold tracking-tight">All Users</span>
          <span className="text-[11px] text-[var(--muted-2)]">
            Click a user row to filter the dashboard to just them
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-[12.5px]">
            <thead className="bg-[var(--hover-soft)] text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              <tr>
                <Th>User</Th>
                <Th align="right">Questions</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">Cost</Th>
                <Th align="right">Avg Dur</Th>
                <Th>Sentiment</Th>
                <Th>Last Active</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stroke)]">
              {data.users.map((u) => (
                <tr
                  key={u.user_id}
                  className="cursor-pointer hover:bg-[var(--hover-soft)]"
                  onClick={() => onPickUser(u.user_id)}
                >
                  <Td className="font-mono">{u.user_id}</Td>
                  <Td align="right">{u.questions}</Td>
                  <Td align="right">{u.sessions}</Td>
                  <Td align="right" className="num">
                    ${u.cost_usd.toFixed(4)}
                  </Td>
                  <Td align="right" className="num">
                    {u.avg_dur_ms ? `${(u.avg_dur_ms / 1000).toFixed(2)}s` : "—"}
                  </Td>
                  <Td>
                    <SentimentBar likes={u.likes} dislikes={u.dislikes} />
                  </Td>
                  <Td
                    className="text-[var(--muted-2)]"
                    title={absoluteTime(u.last_active)}
                  >
                    {relativeTime(u.last_active)}
                  </Td>
                </tr>
              ))}
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--muted-2)]">
                    No users in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ActivityBar({
  row,
  rank,
  max,
  mode,
  onClick,
}: {
  row: UserActivityRow;
  rank: number;
  max: number;
  mode: Mode;
  onClick: () => void;
}) {
  const value = modeValue(row, mode);
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-1.5 rounded-[10px] border border-transparent px-2 py-1.5 text-left hover:border-[var(--stroke)] hover:bg-[var(--hover-soft)]"
    >
      <div className="flex items-center justify-between gap-2 text-[12.5px]">
        <span className="flex items-center gap-2">
          <span className="num text-[var(--muted-3)]">#{rank}</span>
          <span className="font-mono font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
            {row.user_id}
          </span>
          <span className="text-[var(--muted-2)]">
            Q: {row.questions} · Sess: {row.sessions} · ${row.cost_usd.toFixed(2)} · Avg{" "}
            {row.avg_dur_ms ? `${(row.avg_dur_ms / 1000).toFixed(1)}s` : "—"}
          </span>
        </span>
        <span className="num text-[12px] font-bold text-[var(--text)]">
          {modeFormat(mode, value)}
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
  );
}

/**
 * Two-color ratio bar showing likes vs dislikes. Falls back to a neutral
 * "no feedback" indicator when the user hasn't received any signal.
 */
function SentimentBar({ likes, dislikes }: { likes: number; dislikes: number }) {
  const total = likes + dislikes;
  if (total === 0) {
    return (
      <span className="text-[11.5px] text-[var(--muted-3)]">no feedback</span>
    );
  }
  const likePct = (likes / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-[6px] w-[80px] overflow-hidden rounded-full bg-[var(--loss-soft)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--gain)]"
          style={{ width: `${likePct}%` }}
        />
      </div>
      <span className="inline-flex items-center gap-2 text-[11.5px]">
        <span className="inline-flex items-center gap-0.5 text-[var(--gain)]">
          <ThumbsUp size={10} /> {likes}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[var(--loss)]">
          <ThumbsDown size={10} /> {dislikes}
        </span>
      </span>
    </div>
  );
}

function modeValue(r: UserActivityRow, m: Mode): number {
  return m === "cost" ? r.cost_usd : m === "sessions" ? r.sessions : r.questions;
}
function modeFormat(m: Mode, v: number) {
  if (m === "cost") return `$${v.toFixed(4)}`;
  return String(v);
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
