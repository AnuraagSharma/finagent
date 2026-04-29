"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "./Toaster";

const choices = ["Great", "OK", "Needs work"];

export function FeedbackView({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const show = useToast((s) => s.show);

  function submit() {
    try {
      const raw = localStorage.getItem("finagent:lastFeedback");
      const _ = raw; // eslint-disable-line @typescript-eslint/no-unused-vars
    } catch {}
    try {
      localStorage.setItem(
        "finagent:lastFeedback",
        JSON.stringify({ rating: selected, text, ts: Date.now() })
      );
    } catch {}
    show("Thanks for the feedback.");
    onClose();
  }

  return (
    <div>
      <div className="mb-1.5 text-[12px] uppercase tracking-[0.12em] text-[var(--muted-2)]">
        How was the answer?
      </div>
      <div className="mb-3.5 flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSelected(c)}
            className={cn(
              "rounded-full border px-2.5 py-1.5 text-[12.5px]",
              selected === c
                ? "border-[var(--stroke-accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                : "border-[var(--stroke)] text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mb-1.5 text-[12px] uppercase tracking-[0.12em] text-[var(--muted-2)]">
        Tell us more
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What worked? What didn't? Anything you'd like to see?"
        className="min-h-[110px] w-full rounded-[12px] border border-[var(--stroke)] bg-[var(--bg-2)] p-2.5 text-[14px] outline-none focus:border-[var(--stroke-accent)] focus:shadow-[0_0_0_4px_var(--accent-soft)]"
      />

      <div className="mt-3.5 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="text-btn rounded-[10px] px-2.5 py-2 text-[13.5px] font-semibold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-[11px] border border-black/[0.18] bg-[var(--accent)] px-3 py-2 text-[13px] font-bold text-[#06141b] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_16px_var(--accent-glow)] hover:brightness-110"
        >
          Send feedback
        </button>
      </div>
    </div>
  );
}
