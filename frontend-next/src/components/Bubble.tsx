"use client";

import { motion } from "framer-motion";
import { Markdown } from "./Markdown";
import { renderMarkdownLite } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import { useToast } from "./Toaster";
import { useState } from "react";
import {
  Check,
  Copy as CopyIcon,
  RotateCw,
  ThumbsDown,
  ThumbsUp,
  Reply,
} from "lucide-react";

type Props = {
  role: "user" | "assistant";
  text: string;
  meta?: string;
  onRegenerate?: () => void;
  onFollowup?: () => void;
};

/** Branded mark for the assistant — small candle/chevron set */
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

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "assistant") {
    return (
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[#06141b]"
        style={{
          background:
            "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
          boxShadow: "0 6px 16px var(--accent-glow)",
        }}
        aria-label="Assistant"
      >
        <AssistantMark size={14} />
      </div>
    );
  }
  return (
    <div
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--stroke-2)] bg-[var(--bg-2)] text-[12px] font-extrabold text-[var(--text)]"
      aria-label="You"
    >
      U
    </div>
  );
}

function Chip({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
        active
          ? "border-[var(--stroke-accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--stroke)] bg-white/[0.025] text-[var(--muted)] hover:border-[var(--stroke-2)] hover:bg-white/[0.06] hover:text-[var(--text)]"
      )}
    >
      {children}
    </button>
  );
}

export function Bubble({ role, text, meta, onRegenerate, onFollowup }: Props) {
  const isAssistant = role === "assistant";
  const show = useToast((s) => s.show);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [copied, setCopied] = useState(false);

  const content = (
    <div className="text-[15.5px] leading-[1.7] text-[var(--text)]">
      <Markdown text={text} />
    </div>
  );

  // User bubble — neutral panel, no green
  const userBubble = (
    <div
      className={cn(
        "max-w-[78%] rounded-[16px] border border-[var(--stroke-2)] bg-[var(--panel)] px-4 py-3 text-[14.5px]",
        "shadow-[0_8px_24px_rgba(0,0,0,0.25)] ring-inset-soft"
      )}
    >
      <div
        className="whitespace-pre-wrap break-words leading-relaxed text-[var(--text)] [&_p]:m-0"
        dangerouslySetInnerHTML={{ __html: renderMarkdownLite(text) }}
      />
    </div>
  );

  // Assistant block — left accent rail + clean card
  const assistantBlock = (
    <div className="max-w-[860px] flex-1">
      <div
        className={cn(
          "relative rounded-[16px] border border-[var(--stroke)] bg-[var(--panel)]/60 px-4 py-4 ring-inset-soft",
          "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[2px] before:rounded-full before:bg-gradient-to-b before:from-[var(--accent)] before:to-[var(--accent-2)]"
        )}
      >
        {content}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
              show("Copied.");
            } catch {
              show("Copy failed.");
            }
          }}
          title="Copy"
        >
          {copied ? <Check size={12} /> : <CopyIcon size={12} />}
          {copied ? "Copied" : "Copy"}
        </Chip>
        <Chip
          onClick={() => {
            setFeedback("like");
            show("Thanks for the feedback.");
          }}
          active={feedback === "like"}
          title="Like"
        >
          <ThumbsUp size={12} /> Like
        </Chip>
        <Chip
          onClick={() => {
            setFeedback("dislike");
            show("Got it — I'll improve.");
          }}
          active={feedback === "dislike"}
          title="Dislike"
        >
          <ThumbsDown size={12} /> Dislike
        </Chip>
        {onRegenerate && (
          <Chip onClick={onRegenerate} title="Regenerate">
            <RotateCw size={12} /> Regenerate
          </Chip>
        )}
        {onFollowup && (
          <Chip onClick={onFollowup} title="Ask a follow-up">
            <Reply size={12} /> Follow-up
          </Chip>
        )}
        {meta && (
          <span className="num ml-auto font-mono text-[11px] text-[var(--muted-3)]">
            {meta}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "mx-auto flex items-start gap-3 px-2",
        "max-w-[920px] my-3",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && <Avatar role="assistant" />}
      {isAssistant ? assistantBlock : userBubble}
      {!isAssistant && <Avatar role="user" />}
    </motion.div>
  );
}
