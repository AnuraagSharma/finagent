"use client";

import { Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useSessionFeedback } from "@/lib/stores";
import { useToast } from "./Toaster";

type Rating = "great" | "ok" | "needs-work";

const RATINGS: { id: Rating; label: string; emoji: string; tone: string }[] = [
  { id: "great", label: "Great", emoji: "😄", tone: "var(--gain)" },
  { id: "ok", label: "OK", emoji: "🙂", tone: "var(--warn)" },
  { id: "needs-work", label: "Needs work", emoji: "😕", tone: "var(--loss)" },
];

const MAX_CHARS = 1000;

/**
 * The send-feedback panel that opens in the side Sheet. The previous version
 * was three thin pills + a bare textarea — this one tightens the spacing,
 * uses larger emoji-led rating tiles, gives the textarea a proper focus ring,
 * and shows a live character counter so the user knows the length budget.
 */
export function FeedbackView({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<Rating | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const show = useToast((s) => s.show);

  // Live read of how many 👍 / 👎 the user has given on individual answers
  // in this chat session. Lets the panel acknowledge what they've already
  // said and seed a sensible default rating.
  const likes = useSessionFeedback((s) => s.likes);
  const dislikes = useSessionFeedback((s) => s.dislikes);
  const hasReactions = likes + dislikes > 0;

  const remaining = MAX_CHARS - text.length;
  const canSubmit = !submitting && (selected !== null || text.trim().length > 0);

  function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      localStorage.setItem(
        "finagent:lastFeedback",
        JSON.stringify({
          rating: selected,
          text,
          sessionLikes: likes,
          sessionDislikes: dislikes,
          ts: Date.now(),
        })
      );
    } catch {
      // localStorage may be unavailable (private mode etc.) — non-fatal.
    }
    show("Thanks — feedback received.");
    onClose();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Intro */}
      <div className="flex items-start gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles size={16} />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[var(--text)]">
            How can we improve FinAgent?
          </div>
          <div className="mt-0.5 text-[12.5px] text-[var(--muted-2)]">
            Your feedback shapes the next iteration. Pick a vibe, drop a note —
            anything from a bug to a feature wish.
          </div>
        </div>
      </div>

      {/* Session-reactions summary — only shown when the user has actually
          thumbs-upped or thumbs-downed something in this chat. */}
      {hasReactions && (
        <div className="rounded-[12px] border border-[var(--stroke)] bg-[var(--hover-soft)] p-3">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--muted-2)]">
            Your reactions in this chat
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gain)]/30 bg-[var(--gain-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--gain)]">
              <ThumbsUp size={12} />
              {likes} liked
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--loss)]/30 bg-[var(--loss-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--loss)]">
              <ThumbsDown size={12} />
              {dislikes} disliked
            </span>
            <span className="ml-auto text-[11.5px] text-[var(--muted-3)]">
              We&rsquo;re listening — tell us why below.
            </span>
          </div>
        </div>
      )}

      {/* Rating tiles */}
      <div>
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--muted-2)]">
          Rate this answer
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RATINGS.map((r) => {
            const active = selected === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                aria-pressed={active}
                className={cn(
                  "group flex flex-col items-center justify-center gap-1 rounded-[12px] border px-2 py-3 transition-all",
                  active
                    ? "border-[var(--stroke-accent)] bg-[var(--accent-soft)] shadow-[0_0_0_3px_var(--accent-soft)]"
                    : "border-[var(--stroke)] bg-[var(--hover-soft)] hover:border-[var(--stroke-2)] hover:bg-[var(--hover-stronger)]"
                )}
              >
                <span
                  className="text-[22px] leading-none transition-transform group-hover:scale-110"
                  aria-hidden
                >
                  {r.emoji}
                </span>
                <span
                  className={cn(
                    "text-[12px] font-semibold",
                    active ? "text-[var(--text)]" : "text-[var(--muted)]"
                  )}
                  style={active ? { color: r.tone } : undefined}
                >
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comment */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--muted-2)]">
            Tell us more
          </span>
          <span
            className={cn(
              "num text-[10.5px]",
              remaining < 0 ? "text-[var(--loss)]" : "text-[var(--muted-3)]"
            )}
          >
            {text.length} / {MAX_CHARS}
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS + 200))}
          placeholder="What worked? What didn't? Any feature you'd love to see?"
          className={cn(
            "min-h-[140px] w-full resize-y rounded-[12px] border border-[var(--stroke)] bg-[var(--bg-1)] p-3 text-[13.5px] text-[var(--text)] placeholder:text-[var(--muted-3)] outline-none transition-shadow",
            "focus:border-[var(--stroke-accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          )}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-[10px] px-3 text-[13px] font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition-colors",
            canSubmit
              ? "border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)]/15"
              : "cursor-not-allowed border border-[var(--stroke)] bg-[var(--hover-soft)] text-[var(--muted-3)]"
          )}
        >
          <Send size={13} />
          Send feedback
        </button>
      </div>
    </div>
  );
}
