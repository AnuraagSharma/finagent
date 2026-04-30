"use client";

import { ArrowRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { AnalyticsSessionDetail } from "@/lib/api";
import { StatusChip } from "./StatusChip";

/**
 * Right-side drawer that opens when a session row is clicked. Shows the full transcript
 * with per-turn cost / latency / token metadata, plus a "Resume in chat" action that
 * jumps back to / and rehydrates the thread.
 */
export function SessionDetailDrawer({
  open,
  loading,
  data,
  onClose,
  onResume,
}: {
  open: boolean;
  loading: boolean;
  data: AnalyticsSessionDetail | null;
  onClose: () => void;
  onResume: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ov"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-md"
          />
          <motion.aside
            key="dr"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
            className="fixed right-3 top-3 bottom-3 z-40 flex w-[min(680px,calc(100vw-24px))] flex-col overflow-hidden rounded-[18px] border border-[var(--stroke)] bg-[var(--glass-2)] shadow-[var(--shadow-1)] backdrop-blur-md"
          >
            <header className="flex items-start justify-between gap-3 border-b border-[var(--stroke)] px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--muted-2)]">
                  Session
                </div>
                <div className="font-mono text-[13px] text-[var(--text)]">
                  {data?.thread_id || "—"}
                </div>
                {data?.user_id && (
                  <div className="mt-0.5 text-[12px] text-[var(--muted-2)]">
                    user · <span className="font-mono">{data.user_id}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onResume}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 text-[12.5px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/15"
                >
                  Resume
                  <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] hover:bg-white/5"
                >
                  <X size={14} />
                </button>
              </div>
            </header>
            <div className="scroll-area flex-1 overflow-auto px-4 py-3">
              {loading || !data ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-24 rounded-[12px]" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {data.turns.map((t, i) => (
                    <article
                      key={t.id}
                      className="rounded-[12px] border border-[var(--stroke)] bg-white/[0.02] p-3"
                    >
                      <header className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--muted-2)]">
                            Turn {i + 1}
                          </span>
                          <StatusChip status={t.status} />
                        </div>
                        <div className="num text-[11px] text-[var(--muted-2)]">
                          {t.latency_ms != null ? `${(t.latency_ms / 1000).toFixed(2)}s` : "—"}
                          {t.total_tokens != null && (
                            <> · {t.total_tokens.toLocaleString()} tok</>
                          )}
                          {t.cost_usd != null && <> · ${t.cost_usd.toFixed(4)}</>}
                        </div>
                      </header>
                      <div className="grid grid-cols-1 gap-2">
                        <Block label="User" text={t.user_message} />
                        <Block label="Assistant" text={t.assistant_message} />
                        {t.error_detail && (
                          <Block label="Error" text={t.error_detail} tone="error" />
                        )}
                      </div>
                    </article>
                  ))}
                  {data.turns.length === 0 && (
                    <div className="py-6 text-center text-[var(--muted-2)]">No turns.</div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Block({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone?: "error";
}) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--muted-2)]">
        {label}
      </div>
      <pre
        className={
          "mt-0.5 whitespace-pre-wrap break-words text-[13px] " +
          (tone === "error" ? "text-[var(--loss)]" : "text-[var(--text)]")
        }
      >
        {text || "(empty)"}
      </pre>
    </div>
  );
}
