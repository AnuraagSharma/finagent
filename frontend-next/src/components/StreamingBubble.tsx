"use client";

import { motion } from "framer-motion";
import { Markdown } from "./Markdown";

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
}: {
  text: string;
  done: boolean;
  meta?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="mx-auto my-3 flex max-w-[920px] items-start gap-3 px-2 justify-start"
    >
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[#06141b]"
        style={{
          background:
            "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
          boxShadow: "0 6px 16px var(--accent-glow)",
        }}
      >
        <AssistantMark size={14} />
      </div>
      <div className="max-w-[860px] flex-1">
        <div
          className="relative rounded-[16px] border border-[var(--stroke)] bg-[var(--panel)]/60 px-4 py-4 ring-inset-soft before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[2px] before:rounded-full before:bg-gradient-to-b before:from-[var(--accent)] before:to-[var(--accent-2)]"
        >
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
