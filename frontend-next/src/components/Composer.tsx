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

  const radius = "rounded-2xl";

  return (
    <div
      className={cn(
        "composer-dock-gradient sticky bottom-0 z-20 shrink-0 w-full",
        "mb-3 px-5 pt-3 sm:mb-7 sm:px-8 lg:mb-8 lg:px-10",
        "[padding-bottom:max(1rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div
        ref={wrapRef}
        className={cn(
          "composer-shell relative mx-auto max-w-[920px] backdrop-blur-xl",
          radius
        )}
      >
        <div className={cn("overflow-hidden", radius)}>
          {/* Tool strip — compact, no marketing copy */}
          <div
            className="composer-toolbar flex items-center gap-1 px-2.5 pt-2 pb-1.5 sm:px-3"
            role="toolbar"
            aria-label="Input helpers"
          >
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1",
                "overflow-x-auto overflow-y-hidden",
                "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              )}
            >
              {SKILLS.map((s) => {
                const active = activeSkill === s.id;
                return (
                  <Tooltip key={s.id} label={s.hint}>
                    <button
                      type="button"
                      onClick={() => pickSkill(s)}
                      className={cn(
                        "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium tracking-[-0.01em]",
                        "transition-[background-color,color,box-shadow]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--panel)]",
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "text-[var(--muted-2)] hover:bg-white/[0.055] hover:text-[var(--text)]"
                      )}
                    >
                      <s.Icon
                        size={13}
                        className={cn(
                          "shrink-0 opacity-90",
                          active ? "text-[var(--accent)]" : "text-[var(--muted-3)]"
                        )}
                      />
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <div className="composer-input-row flex items-end gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5">
            <div className="flex shrink-0 items-end pb-px">
              <Tooltip label="Attach (coming soon)">
                <button
                  type="button"
                  disabled
                  className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted-3)] opacity-50 transition-colors hover:text-[var(--muted-2)] disabled:cursor-not-allowed"
                  aria-label="Attach"
                >
                  <Plus size={16} strokeWidth={2} />
                </button>
              </Tooltip>
            </div>

            <textarea
              ref={taRef}
              rows={1}
              placeholder="Message…"
              className="min-h-[44px] max-h-[220px] flex-1 resize-none border-0 bg-transparent px-0.5 py-2.5 text-[15px] leading-[1.55] outline-none placeholder:text-[var(--muted-3)]"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKey}
            />

            <div className="flex shrink-0 items-center pb-px">
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
                    className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--stroke)] bg-white/[0.04] text-[var(--text)] transition-colors hover:bg-white/[0.07]"
                  >
                    <Square size={13} strokeWidth={2.5} />
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
                    className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--accent)] text-[#06141b] shadow-[0_6px_20px_var(--accent-glow)] transition-[filter,transform] hover:brightness-105 active:translate-y-[0.5px]"
                  >
                    <Send size={15} strokeWidth={2.25} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
