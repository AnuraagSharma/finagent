"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Wrench,
  Bot,
  Info,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { TodoItem } from "@/lib/types";
import { cn } from "@/lib/cn";

export type TaskStep = {
  id: string;
  name: string;
  kind: "tool" | "subagent" | "info";
  status: "started" | "completed";
};

const kindStyle = {
  tool: {
    chip: "bg-[var(--tool-soft)] text-[var(--tool)] border-[rgba(96,165,250,0.30)]",
    Icon: Wrench,
  },
  subagent: {
    chip: "bg-[var(--subagent-soft)] text-[var(--subagent)] border-[rgba(129,140,248,0.30)]",
    Icon: Bot,
  },
  info: {
    chip: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--stroke-accent)]",
    Icon: Info,
  },
} as const;

export function TaskCard({
  steps,
  todos,
  done,
  ms,
  visible,
  prettyName,
}: {
  steps: TaskStep[];
  todos: TodoItem[];
  done: boolean;
  ms: number | null;
  visible: boolean;
  prettyName: (s: string) => string;
}) {
  const [open, setOpen] = useState(true);

  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const todosDone = todos.filter(
    (t) => (t.status || "").toLowerCase() === "completed"
  ).length;
  const title = done
    ? ms
      ? `Completed in ${(ms / 1000).toFixed(1)}s`
      : "Completed"
    : "Working on it";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="taskcard"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, scale: 0.985 }}
          transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
          className="mx-auto my-3 max-w-[880px] pl-12 pr-2"
        >
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--panel)]/55 backdrop-blur-sm ring-inset-soft"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--stroke)] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full",
                    done
                      ? "bg-[var(--accent)] text-[#06141b]"
                      : "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--stroke-accent)]"
                  )}
                  style={
                    done
                      ? { boxShadow: "0 4px 14px var(--accent-glow)" }
                      : undefined
                  }
                >
                  {done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <Sparkles size={11} />
                  )}
                </span>
                <span className="truncate text-[13.5px] font-bold text-[var(--text)]">
                  {title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[var(--muted-2)]">
                <span className="num font-mono text-[11.5px] text-[var(--muted)]">
                  {completed}/{total || 0}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="grid h-6 w-6 place-items-center rounded-md hover:bg-white/5"
                  aria-label="Toggle"
                >
                  {open ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
              </div>
            </div>

            {/* Progress */}
            <div
              className={cn(
                "relative h-[3px] overflow-hidden bg-white/5",
                !done && total > 0 && "shimmer-bar"
              )}
            >
              <div
                className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] shadow-[0_0_8px_var(--accent-glow)] transition-all duration-300"
                style={{ width: `${done ? 100 : pct}%` }}
              />
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  {/* Steps with timeline rail */}
                  <div className="timeline-rail relative flex flex-col gap-1 px-3 py-3 text-[13px] text-[var(--muted)]">
                    {steps.map((s, i) => {
                      const style = kindStyle[s.kind];
                      const KindIcon = style.Icon;
                      const active = s.status !== "completed";
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -2 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.18, delay: i * 0.02 }}
                          className="relative z-[1] flex items-center gap-2.5 rounded-md px-1.5 py-1"
                        >
                          {/* Timeline node */}
                          <span
                            className={cn(
                              "relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-all",
                              active
                                ? "bg-[var(--bg-1)] border border-[var(--stroke-accent)] text-[var(--accent)]"
                                : "bg-[var(--accent)] text-[#06141b]"
                            )}
                            style={
                              !active
                                ? { boxShadow: "0 4px 10px var(--accent-glow)" }
                                : undefined
                            }
                          >
                            {active ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={11} strokeWidth={3} />
                            )}
                            {active && (
                              <span className="absolute inset-[-3px] rounded-full border border-[var(--accent)] opacity-30 animate-ping" />
                            )}
                          </span>
                          {/* Kind chip */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.16em]",
                              style.chip
                            )}
                          >
                            <KindIcon size={9} />
                            {s.kind}
                          </span>
                          <span className="truncate text-[13px] text-[var(--text)]">
                            {prettyName(s.name)}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Todos */}
                  {todos.length > 0 && (
                    <div className="border-t border-[var(--stroke)] px-3 py-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-2)]">
                        <span>Plan</span>
                        <span className="num font-mono text-[var(--muted-2)]">
                          {todosDone}/{todos.length}
                        </span>
                      </div>
                      {todos.map((t, i) => {
                        const status = (t.status || "pending").toLowerCase();
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex items-start gap-2 rounded-md px-1.5 py-1 text-[13.5px]",
                              status === "completed"
                                ? "text-[var(--muted-2)] line-through decoration-[var(--stroke-accent)]"
                                : status === "in_progress"
                                  ? "text-[var(--text)]"
                                  : "text-[var(--muted)]"
                            )}
                          >
                            <span
                              className={cn(
                                "relative mt-1 grid h-3.5 w-3.5 place-items-center rounded-full border-[1.5px]",
                                status === "completed"
                                  ? "border-[var(--accent)] bg-[var(--accent)] text-[#06141b]"
                                  : status === "in_progress"
                                    ? "border-[rgba(52,211,153,0.70)]"
                                    : "border-[var(--stroke-2)]"
                              )}
                            >
                              {status === "completed" && (
                                <Check size={9} strokeWidth={4} />
                              )}
                              {status === "in_progress" && (
                                <span className="absolute inset-[-2px] rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
                              )}
                            </span>
                            <span className="flex-1">{t.content}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
