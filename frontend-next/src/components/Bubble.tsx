"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Markdown } from "./Markdown";
import { renderMarkdownLite } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import { useSessionFeedback } from "@/lib/stores";
import { useToast } from "./Toaster";
import { Tooltip } from "./Tooltip";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy as CopyIcon,
  RotateCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Reply,
  X,
} from "lucide-react";
import type { TurnSummary } from "@/lib/types";

/**
 * Quick-pick reasons offered after the user clicks 👍 / 👎. Mirrors Claude.ai's
 * tag palette: positive ones are about quality of the answer, negative ones
 * about specific failure modes the user can flag with one click.
 */
const LIKE_TAGS = [
  "Helpful",
  "Accurate",
  "Well-written",
  "Concise",
] as const;
const DISLIKE_TAGS = [
  "Inaccurate",
  "Not helpful",
  "Too verbose",
  "Refused incorrectly",
] as const;

type FeedbackKind = "like" | "dislike";

type Props = {
  role: "user" | "assistant";
  text: string;
  meta?: string;
  /** Optional snapshot of the turn that produced this assistant message. */
  summary?: TurnSummary;
  onRegenerate?: () => void;
  onFollowup?: () => void;
};

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
}

/**
 * Persistent, collapsed pill rendered above the assistant content. Click to
 * expand the captured steps inline (durations, kinds). Replaces the live
 * TaskCard once a turn finishes — the user can always come back to inspect
 * what the agent actually did to produce this answer.
 */
function TurnSummaryPill({ summary }: { summary: TurnSummary }) {
  const [open, setOpen] = useState(false);
  const toolCount = summary.steps.length;
  const ms = summary.ms;
  const headline =
    toolCount === 0
      ? ms != null
        ? `Answered in ${fmtDuration(Math.max(ms, 100))}`
        : "Answered"
      : `Used ${toolCount} ${toolCount === 1 ? "tool" : "tools"}${
          ms != null ? ` · ${fmtDuration(Math.max(ms, 100))}` : ""
        }`;

  return (
    <div className="mb-2 max-w-[860px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] px-2.5 py-1",
          "bg-[var(--panel)]/60 text-[12px] font-medium text-[var(--muted)]",
          "transition-colors hover:border-[var(--stroke-accent)] hover:bg-[var(--accent-soft)]/60 hover:text-[var(--text)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]"
        )}
      >
        <Sparkles size={11} className="text-[var(--accent)]" />
        <span className="num">{headline}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.25}
          className={cn(
            "text-[var(--muted-2)] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="summary-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-[var(--stroke)] bg-[var(--panel)]/60 px-3 py-2.5">
              {summary.steps.length === 0 ? (
                <div className="text-[12.5px] text-[var(--muted-2)]">
                  No tool calls.
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {summary.steps.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]"
                    >
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[#06141b]">
                        <Check size={9} strokeWidth={3} />
                      </span>
                      <span className="flex-1 truncate text-[var(--text)]">
                        {String(s.name || "step").replace(/[_-]+/g, " ")}
                      </span>
                      <span className="num shrink-0 text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted-3)]">
                        {s.kind}
                      </span>
                      {typeof s.durationMs === "number" &&
                        s.durationMs > 500 && (
                          <span className="num font-mono text-[10.5px] tabular-nums text-[var(--muted-3)]">
                            {fmtDuration(s.durationMs)}
                          </span>
                        )}
                    </li>
                  ))}
                </ul>
              )}
              {summary.todos.length > 0 && (
                <div className="mt-2 border-t border-[var(--stroke)] pt-2">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-3)]">
                    Plan
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {summary.todos.map((t, i) => (
                      <li
                        key={i}
                        className={cn(
                          "text-[12.5px] leading-snug",
                          (t.status || "").toLowerCase() === "completed"
                            ? "text-[var(--muted-2)] line-through decoration-[var(--stroke-accent)]/80"
                            : "text-[var(--muted)]"
                        )}
                      >
                        {t.content}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
              : "bg-[var(--hover-stronger)] text-[var(--text)]"
            : "text-[var(--muted-2)] hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function Bubble({ role, text, meta, summary, onRegenerate, onFollowup }: Props) {
  const isAssistant = role === "assistant";
  const show = useToast((s) => s.show);
  const [copied, setCopied] = useState(false);

  /**
   * Feedback state — mirrors Claude.ai's flow:
   *   1. Click 👍 / 👎 → button goes active immediately AND a card expands below.
   *   2. User picks tags (multi-select) and/or types a comment, then Submits.
   *   3. After Submit the card collapses, button stays active permanently.
   *   4. Clicking the same active button again clears the feedback entirely.
   *   5. Clicking the opposite button switches kind and resets tags/comment.
   */
  const [feedback, setFeedback] = useState<FeedbackKind | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState<FeedbackKind | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const bumpReaction = useSessionFeedback((s) => s.bump);
  const feedbackCardRef = useRef<HTMLDivElement | null>(null);

  /**
   * When the feedback card opens (especially on the latest assistant turn),
   * the sticky composer at the bottom of the page would otherwise hide it.
   * Auto-scroll the card into view with `scroll-margin-bottom` set on the
   * element so the browser leaves room for the dock.
   */
  useEffect(() => {
    if (!feedbackOpen) return;
    const id = window.requestAnimationFrame(() => {
      feedbackCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [feedbackOpen]);

  function openFeedback(kind: FeedbackKind) {
    // Same active thumb pressed again with the card open → clear feedback
    if (feedback === kind && feedbackOpen === kind) {
      // Roll back the session counter for whichever bucket was active.
      bumpReaction(kind, -1);
      setFeedback(null);
      setFeedbackOpen(null);
      setFeedbackTags([]);
      setFeedbackComment("");
      setFeedbackSent(false);
      return;
    }
    // Switching from one kind to the other → undo old bucket, increment new.
    if (feedback && feedback !== kind) {
      bumpReaction(feedback, -1);
      bumpReaction(kind, +1);
    } else if (!feedback) {
      // First-time reaction on this turn.
      bumpReaction(kind, +1);
    }
    setFeedback(kind);
    setFeedbackOpen(kind);
    if (feedbackOpen !== kind) {
      setFeedbackTags([]);
      setFeedbackComment("");
      setFeedbackSent(false);
    }
  }

  function toggleFeedbackTag(tag: string) {
    setFeedbackTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function submitFeedback() {
    if (!feedbackOpen || feedbackSent) return;
    // Future: POST { kind: feedbackOpen, tags, comment, message: text } to /v1/feedback.
    // For now we just persist locally and acknowledge inline.
    setFeedbackSent(true);
    show("Thanks for the feedback.");
    // Auto-close shortly so the action row settles back to a clean state.
    setTimeout(() => setFeedbackOpen(null), 900);
  }

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
      {summary && <TurnSummaryPill summary={summary} />}
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
          onClick={() => openFeedback("like")}
          active={feedback === "like"}
          tone="accent"
        >
          <ThumbsUp size={15} strokeWidth={2} />
        </IconAction>
        <IconAction
          label="Bad response"
          onClick={() => openFeedback("dislike")}
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

      {/*
        Inline feedback card — expands directly under the action row when the
        user clicks 👍 / 👎 (Claude.ai pattern). Tags + comment are optional;
        Submit dismisses, Cancel closes without sending. The thumb stays in
        active state after submit so the user has a permanent record of the
        signal they gave on this message.
      */}
      <AnimatePresence initial={false}>
        {feedbackOpen && (
          <motion.div
            key={`fb-${feedbackOpen}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              ref={feedbackCardRef}
              // scroll-margin-bottom keeps the card clear of the sticky
              // composer dock when scrollIntoView fires.
              style={{ scrollMarginBottom: 220, scrollMarginTop: 80 }}
              className="mt-2 max-w-[680px] rounded-xl border border-[var(--stroke-2)] bg-[var(--panel-2)] p-3 shadow-[var(--shadow-2)]"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-[13px] font-semibold text-[var(--text)]">
                  {feedbackOpen === "like"
                    ? "What did you like about this response?"
                    : "What could be better?"}
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(null)}
                  aria-label="Close feedback"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--muted-2)] transition-colors hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
                >
                  <X size={12} strokeWidth={2.25} />
                </button>
              </div>

              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {(feedbackOpen === "like" ? LIKE_TAGS : DISLIKE_TAGS).map(
                  (tag) => {
                    const selected = feedbackTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleFeedbackTag(tag)}
                        aria-pressed={selected}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)]",
                          selected
                            ? "border-[var(--stroke-accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--stroke)] text-[var(--muted)] hover:border-[var(--stroke-accent)] hover:text-[var(--text)]"
                        )}
                      >
                        {selected && <Check size={10} strokeWidth={3} />}
                        {tag}
                      </button>
                    );
                  }
                )}
              </div>

              <textarea
                rows={2}
                placeholder={
                  feedbackOpen === "like"
                    ? "Anything else? (optional)"
                    : "More details (optional)"
                }
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className={cn(
                  "block w-full resize-none rounded-lg border bg-[var(--bg-1)] px-2.5 py-1.5 text-[13px] leading-snug",
                  "border-[var(--stroke)] text-[var(--text)] outline-none placeholder:text-[var(--muted-3)]",
                  "focus:border-[var(--stroke-accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                )}
              />

              <div className="mt-2 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(null)}
                  className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={feedbackSent}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-[filter,background-color,color]",
                    feedbackSent
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--accent)] text-[var(--on-accent)] hover:brightness-105 active:translate-y-[0.5px]"
                  )}
                >
                  {feedbackSent ? (
                    <>
                      <Check size={11} strokeWidth={3} /> Sent
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
