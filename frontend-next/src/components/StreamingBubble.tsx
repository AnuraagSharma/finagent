"use client";

import { motion } from "framer-motion";
import { Markdown } from "./Markdown";

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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.75, 0.15, 1] }}
      className="mx-auto flex w-full max-w-[920px] items-start justify-start px-2"
      role="status"
      aria-live="polite"
      aria-busy={!done}
    >
      <div className="max-w-[860px] flex-1 min-w-0">
        <div className="relative px-1 py-2">
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
