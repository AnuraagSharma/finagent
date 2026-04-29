"use client";

import { motion } from "framer-motion";
import { Markdown } from "./Markdown";
import { cn } from "@/lib/cn";

function AssistantMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 19V5h11"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 12h7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M14 14l3-3 3 3"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StreamingBubble({
  text,
  done,
  meta,
  live = true,
}: {
  text: string;
  done: boolean;
  meta?: string;
  /** Show live / drafting affordances (motion + label). Respects prefers-reduced-motion in CSS. */
  live?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.75, 0.15, 1] }}
      className="mx-auto flex w-full max-w-[920px] items-start gap-3 justify-start px-2"
      role="status"
      aria-live="polite"
      aria-busy={!done}
    >
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[#06141b]",
          live && !done && "streaming-avatar-live"
        )}
        style={{
          background:
            "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
          boxShadow: "0 6px 16px var(--accent-glow)",
        }}
      >
        <AssistantMark size={14} />
      </div>
      <div className="max-w-[860px] flex-1 min-w-0">
        <div
          className={cn(
            "relative rounded-[16px] border border-[var(--stroke)] bg-[var(--panel)]/60 px-4 py-4 ring-inset-soft",
            "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[2px] before:rounded-full before:bg-gradient-to-b before:from-[var(--accent)] before:to-[var(--accent-2)]",
            live && !done && "streaming-card-live"
          )}
        >
          {live && !done && (
            <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2 border-b border-[var(--stroke)]/80 pb-2.5">
              <span
                className="live-dot-indicator inline-flex h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--accent)]"
                aria-hidden
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                Live
              </span>
              <span className="text-[12.5px] text-[var(--muted)]">Drafting reply</span>
            </div>
          )}
          <div className="text-[15.5px] leading-[1.7] text-[var(--text)]">
            <Markdown text={text || ""} />
          </div>
          {!done && <span className="typing-cursor" />}
        </div>
        {meta && (
          <div className="mt-2 font-mono text-[11px] text-[var(--muted-3)]">
            {meta}
          </div>
        )}
      </div>
    </motion.div>
  );
}
