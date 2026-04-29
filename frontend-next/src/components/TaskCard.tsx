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
import { useMemo, useState } from "react";
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
    pill: "bg-[var(--tool-soft)]/80 text-[var(--tool)] border-[rgba(96,165,250,0.22)]",
    Icon: Wrench,
  },
  subagent: {
    pill: "bg-[var(--subagent-soft)]/80 text-[var(--subagent)] border-[rgba(129,140,248,0.22)]",
    Icon: Bot,
  },
  info: {
    pill: "bg-[var(--accent-soft)]/90 text-[var(--accent)] border-[var(--stroke-accent)]/50",
    Icon: Info,
  },
} as const;

const kindLabel: Record<TaskStep["kind"], string> = {
  tool: "Tool",
  subagent: "Sub-agent",
  info: "Status",
};

export function TaskCard({
  steps,
  todos,
  done,
  ms,
  visible,
  replyDrafting = false,
  prettyName,
}: {
  steps: TaskStep[];
  todos: TodoItem[];
  done: boolean;
  ms: number | null;
  visible: boolean;
  /** True while assistant tokens stream — cues “scroll to answer” vs still in tools-only phase */
  replyDrafting?: boolean;
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
      ? `Finished in ${(ms / 1000).toFixed(1)}s`
      : "Finished"
    : "Working";

  const activeStep = useMemo(
    () =>
      [...steps].reverse().find((s) => s.status !== "completed") ?? null,
    [steps]
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="taskcard"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, scale: 0.985 }}
          transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
          className="mx-auto flex w-full max-w-[920px] items-start gap-3 px-2"
          aria-busy={!done}
          role="status"
          aria-live="polite"
        >
          <span className="h-8 w-8 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 max-w-[860px]">
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[color-mix(in_oklab,var(--panel)_70%,var(--bg)_30%)] backdrop-blur-sm ring-inset-soft shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke)]/90 px-3.5 py-2.5">
              <div className="min-w-0 flex flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      done
                        ? "bg-[var(--accent)] text-[#06141b]"
                        : "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--stroke-accent)]/60"
                    )}
                    style={
                      done
                        ? { boxShadow: "0 4px 14px var(--accent-glow)" }
                        : undefined
                    }
                  >
                    {done ? (
                      <Check size={13} strokeWidth={2.75} />
                    ) : (
                      <Sparkles size={12} />
                    )}
                  </span>
                  <span className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
                    {title}
                  </span>
                </div>
                {!done && replyDrafting && (
                  <p className="line-clamp-2 pl-9 text-[12.5px] leading-snug text-[var(--muted)]">
                    <span className="font-medium text-[var(--accent)]">Reply · </span>
                    streaming below
                  </p>
                )}
                {!done && !replyDrafting && activeStep && (
                  <p className="line-clamp-2 pl-9 text-[12.5px] leading-snug text-[var(--muted)]">
                    <span className="text-[var(--muted-2)]">Now · </span>
                    {prettyName(activeStep.name)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[var(--muted-2)]">
                <span className="num font-mono text-[11px] tabular-nums text-[var(--muted)]">
                  {completed}/{total || 0}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-[var(--muted-2)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text)]"
                  aria-expanded={open}
                  aria-label={open ? "Collapse steps" : "Expand steps"}
                >
                  {open ? (
                    <ChevronDown size={15} strokeWidth={2} />
                  ) : (
                    <ChevronRight size={15} strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>

            {/* Progress */}
            <div
              className={cn(
                "relative h-[2px] overflow-hidden bg-white/[0.06]",
                !done && total > 0 && "shimmer-bar"
              )}
            >
              <div
                className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] shadow-[0_0_8px_var(--accent-glow)] transition-[width] duration-500 ease-out"
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
                  transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="timeline-rail relative flex flex-col gap-0.5 px-3 py-3 sm:px-4">
                    {steps.map((s, i) => {
                      const style = kindStyle[s.kind];
                      const KindIcon = style.Icon;
                      const active = s.status !== "completed";
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.025 }}
                          className={cn(
                            "relative z-[1] flex items-center gap-3 rounded-xl border border-transparent py-1.5 pl-2 pr-2 transition-colors",
                            active ? "bg-white/[0.035]" : ""
                          )}
                        >
                          <span
                            className={cn(
                              "relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-all",
                              active
                                ? "border border-[var(--stroke-accent)] bg-[var(--bg-1)] text-[var(--accent)]"
                                : "bg-[var(--accent)] text-[#06141b]"
                            )}
                            style={
                              !active
                                ? { boxShadow: "0 3px 10px var(--accent-glow)" }
                                : undefined
                            }
                          >
                            {active ? (
                              <Loader2 size={11} className="animate-spin" strokeWidth={2.5} />
                            ) : (
                              <Check size={10} strokeWidth={3} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-[13.5px] font-medium leading-snug text-[var(--text)]">
                                {prettyName(s.name)}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium",
                                  style.pill
                                )}
                              >
                                <KindIcon size={10} strokeWidth={2.25} />
                                {kindLabel[s.kind]}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Todos */}
                  {todos.length > 0 && (
                    <div className="border-t border-[var(--stroke)]/90 px-3 py-2.5 sm:px-4">
                      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-2)]">
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
                              "flex items-start gap-2.5 rounded-lg px-1 py-1 text-[13.5px] leading-snug",
                              status === "completed"
                                ? "text-[var(--muted-2)] line-through decoration-[var(--stroke-accent)]/80"
                                : status === "in_progress"
                                  ? "text-[var(--text)]"
                                  : "text-[var(--muted)]"
                            )}
                          >
                            <span
                              className={cn(
                                "relative mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px]",
                                status === "completed"
                                  ? "border-[var(--accent)] bg-[var(--accent)] text-[#06141b]"
                                  : status === "in_progress"
                                    ? "border-[rgba(52,211,153,0.65)]"
                                    : "border-[var(--stroke-2)]"
                              )}
                            >
                              {status === "completed" && (
                                <Check size={9} strokeWidth={3.5} />
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
