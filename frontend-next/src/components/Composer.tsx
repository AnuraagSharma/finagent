"use client";

import {
  Plus,
  Send,
  Square,
  Globe,
  FileText,
  GitCompareArrows,
  BarChart3,
  Database,
  Sparkles,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

export type ComposerHandle = {
  focus: () => void;
  setValue: (v: string) => void;
  pulse: () => void;
};

type Props = {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
};

type Skill = {
  id: string;
  label: string;
  hint: string;
  prefix: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const SKILLS: Skill[] = [
  {
    id: "web",
    label: "Web",
    hint: "Search the open web",
    prefix: "Search the web for: ",
    Icon: Globe,
  },
  {
    id: "filings",
    label: "Filings",
    hint: "10-K / 10-Q / 8-K",
    prefix: "Read the latest filing and summarise: ",
    Icon: FileText,
  },
  {
    id: "compare",
    label: "Compare",
    hint: "Side-by-side analysis",
    prefix: "Compare: ",
    Icon: GitCompareArrows,
  },
  {
    id: "chart",
    label: "Chart",
    hint: "Render a chart",
    prefix: "Plot a chart of: ",
    Icon: BarChart3,
  },
  {
    id: "data",
    label: "Data",
    hint: "Pull structured data",
    prefix: "Pull structured data on: ",
    Icon: Database,
  },
];

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { onSend, onStop, isStreaming, disabled }: Props,
  ref
) {
  const [value, setValue] = useState("");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, el.scrollHeight)}px`;
  }

  useEffect(() => {
    autoGrow();
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => taRef.current?.focus(),
      setValue: (v: string) => {
        setValue(v);
        requestAnimationFrame(() => {
          autoGrow();
          taRef.current?.focus();
        });
      },
      pulse: () => {
        const el = wrapRef.current;
        if (!el) return;
        el.classList.remove("composer-pulse");
        void el.offsetWidth;
        el.classList.add("composer-pulse");
      },
    }),
    []
  );

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const v = value.trim();
    if (!v || disabled) return;
    setValue("");
    setActiveSkill(null);
    requestAnimationFrame(autoGrow);
    onSend(v);
  }

  function pickSkill(s: Skill) {
    setActiveSkill((curr) => (curr === s.id ? null : s.id));
    const current = value.trim();
    // If composer is empty, prefill the prefix; otherwise prepend the prefix.
    const next = current
      ? current.startsWith(s.prefix.trimEnd())
        ? current
        : `${s.prefix}${current}`
      : s.prefix;
    setValue(next);
    requestAnimationFrame(() => {
      autoGrow();
      taRef.current?.focus();
      // Move caret to end
      const el = taRef.current;
      if (el) el.selectionStart = el.selectionEnd = el.value.length;
    });
  }

  return (
    <div className="sticky bottom-0 px-4 py-3 [background:linear-gradient(180deg,transparent,var(--bg)_28%)]">
      <div
        ref={wrapRef}
        className={cn(
          "relative mx-auto max-w-[920px] rounded-[22px] border border-[var(--stroke-2)] bg-[var(--glass-2)] backdrop-blur-md shadow-[var(--shadow-1)]",
          "transition-shadow",
          "focus-within:border-[var(--stroke-accent)] focus-within:shadow-[0_0_0_4px_rgba(52,211,153,0.12),var(--shadow-1)]"
        )}
      >
        {/* Skill chips row */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--muted-3)]">
            <Sparkles size={10} className="text-[var(--accent)]" />
            Skills
          </span>
          {SKILLS.map((s) => {
            const active = activeSkill === s.id;
            return (
              <Tooltip key={s.id} label={s.hint}>
                <button
                  type="button"
                  onClick={() => pickSkill(s)}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
                    active
                      ? "border-[var(--stroke-accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--stroke)] bg-white/[0.025] text-[var(--muted)] hover:border-[var(--stroke-accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
                  )}
                >
                  <s.Icon size={11} />
                  {s.label}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Main row */}
        <div className="flex items-end gap-1.5 px-2 py-1.5 pl-3">
          <div className="flex items-center gap-1 py-1">
            <Tooltip label="Attach (coming soon)">
              <button
                type="button"
                disabled
                className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] text-[var(--muted)] opacity-60"
                aria-label="Attach"
              >
                <Plus size={14} />
              </button>
            </Tooltip>
          </div>

          <textarea
            ref={taRef}
            rows={1}
            placeholder="Ask anything about markets, filings, or fundamentals…"
            className="min-h-[44px] max-h-[220px] flex-1 resize-none border-0 bg-transparent px-1.5 py-3 text-[15px] outline-none placeholder:text-[var(--muted-3)]"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
          />

          <div className="flex items-center gap-1 py-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {isStreaming ? (
                <motion.button
                  key="stop"
                  type="button"
                  onClick={onStop}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.14 }}
                  title="Stop generating"
                  aria-label="Stop generating"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[var(--text)] hover:bg-white/10 border border-[var(--stroke-2)]"
                >
                  <Square size={14} />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  type="button"
                  onClick={submit}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.14 }}
                  aria-label="Send"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-[#06141b] shadow-[0_6px_18px_var(--accent-glow)] hover:brightness-110 active:translate-y-px"
                >
                  <Send size={16} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
});
