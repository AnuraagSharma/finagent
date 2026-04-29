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
  User,
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
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--ai)_38%,transparent)]",
        "bg-[color-mix(in_oklab,var(--bg-2)_90%,var(--ai)_10%)]",
        "text-[var(--ai-2)] shadow-[0_2px_14px_rgba(0,0,0,0.22)]"
      )}
      aria-label="You"
    >
      <User size={14} strokeWidth={2.4} aria-hidden />
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

  // User bubble — right-aligned “you”; subtle ai-tint identity, typography aligned with assistant
  const userBubble = (
    <div
      className={cn(
        "relative max-w-[min(92%,38rem)] rounded-2xl rounded-br-[10px]",
        "border border-[var(--stroke)]/90 bg-[color-mix(in_oklab,var(--panel-2)_90%,var(--ai)_10%)]",
        "shadow-[0_10px_40px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.06)]",
        "ring-inset-soft",
        "after:pointer-events-none after:absolute after:inset-y-3 after:right-0 after:w-px after:rounded-full after:bg-[color-mix(in_oklab,var(--ai)_65%,transparent)] after:opacity-70"
      )}
    >
      <div
        className={cn(
          "px-4 py-3.5",
          "whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-[var(--text)]",
          "[&_p]:m-0 [&_p+p]:mt-2.5",
          "[&_strong]:font-semibold [&_strong]:text-[var(--text)]",
          "[&_code]:rounded-md [&_code]:border [&_code]:border-[var(--stroke)]/80 [&_code]:bg-[color-mix(in_oklab,var(--bg)_55%,black_35%)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-[1.2em]",
          "[&_li]:mt-1"
        )}
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
      initial={
        isAssistant ? { opacity: 0, y: 6 } : { opacity: 0, y: 10, scale: 0.985 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        isAssistant
          ? { duration: 0.22 }
          : { type: "spring", stiffness: 440, damping: 32 }
      }
      className={cn(
        "mx-auto flex w-full max-w-[920px] items-start gap-3 px-2",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && <Avatar role="assistant" />}
      {isAssistant ? assistantBlock : userBubble}
      {!isAssistant && <Avatar role="user" />}
    </motion.div>
  );
}
