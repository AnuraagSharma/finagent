"use client";

import { motion } from "framer-motion";
import { Markdown } from "./Markdown";
import { renderMarkdownLite } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import { useToast } from "./Toaster";
import { Tooltip } from "./Tooltip";
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

/** ChatGPT/Gemini-style minimal icon action — borderless, subtle hover, tooltip label. */
function IconAction({
  label,
  onClick,
  active,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: "neutral" | "accent";
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} placement="bottom">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]",
          active
            ? tone === "accent"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-white/[0.07] text-[var(--text)]"
            : "text-[var(--muted-2)] hover:bg-white/[0.05] hover:text-[var(--text)]"
        )}
      >
        {children}
      </button>
    </Tooltip>
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

  // User bubble — calm soft fill, no border / edge accent, ChatGPT-style
  const userBubble = (
    <div
      className={cn(
        "relative max-w-[min(92%,38rem)] rounded-2xl",
        "bg-[var(--panel-2)]"
      )}
    >
      <div
        className={cn(
          "px-4 py-3.5",
          "whitespace-pre-wrap break-words text-[15px] leading-[1.65] text-[var(--text)]",
          "[&_p]:m-0 [&_p+p]:mt-2.5",
          "[&_strong]:font-semibold [&_strong]:text-[var(--text)]",
          "[&_code]:rounded-[5px] [&_code]:bg-white/[0.07] [&_code]:px-[5px] [&_code]:py-[1.5px] [&_code]:font-mono [&_code]:text-[0.92em]",
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
      <div className="relative px-1 py-2">{content}</div>
      <div className="mt-1.5 flex items-center gap-0.5 px-1">
        <IconAction
          label={copied ? "Copied" : "Copy"}
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
          active={copied}
        >
          {copied ? <Check size={15} strokeWidth={2.25} /> : <CopyIcon size={15} strokeWidth={2} />}
        </IconAction>
        <IconAction
          label="Good response"
          onClick={() => {
            setFeedback("like");
            show("Thanks for the feedback.");
          }}
          active={feedback === "like"}
          tone="accent"
        >
          <ThumbsUp size={15} strokeWidth={2} />
        </IconAction>
        <IconAction
          label="Bad response"
          onClick={() => {
            setFeedback("dislike");
            show("Got it — I'll improve.");
          }}
          active={feedback === "dislike"}
        >
          <ThumbsDown size={15} strokeWidth={2} />
        </IconAction>
        {onRegenerate && (
          <IconAction label="Regenerate" onClick={onRegenerate}>
            <RotateCw size={15} strokeWidth={2} />
          </IconAction>
        )}
        {onFollowup && (
          <IconAction label="Reply / follow-up" onClick={onFollowup}>
            <Reply size={15} strokeWidth={2} />
          </IconAction>
        )}
        {meta && (
          <span className="num ml-auto font-mono text-[10.5px] text-[var(--muted-3)]">
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
        "mx-auto flex w-full max-w-[920px] items-start px-2",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant ? assistantBlock : userBubble}
    </motion.div>
  );
}
