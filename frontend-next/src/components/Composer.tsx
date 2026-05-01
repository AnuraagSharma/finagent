"use client";

import {
  Paperclip,
  Send,
  Square,
  Globe,
  FileText,
  GitCompareArrows,
  BarChart3,
  Database,
  X,
  FileSpreadsheet,
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
import { fmtBytes, gridToMarkdownTable, parseCsv } from "@/lib/csv";
import { useToast } from "./Toaster";

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

/** A staged CSV attachment held in composer state until the user hits send. */
type Attachment = {
  id: string;
  name: string;
  bytes: number;
  /** Pre-formatted markdown table prepended to the user's message at submit. */
  body: string;
  /** Rows beyond the cap, surfaced in the chip tooltip. */
  truncatedRows: number;
};

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/**
 * The chat composer ("search bar") at the bottom of the conversation.
 *
 * The previous design stacked three surfaces of slightly different shades —
 * darker toolbar / medium shell / darker input row — which made the bar feel
 * busy and seam-y. This rewrite flattens it: one solid `var(--panel)` surface
 * with a subtle `var(--stroke)` border, separated internally by hairline
 * dividers (same bg, just border-b). Focus pulls a soft accent ring around
 * the whole shell so the active state is immediately readable.
 */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { onSend, onStop, isStreaming, disabled }: Props,
  ref
) {
  const [value, setValue] = useState("");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const showToast = useToast((s) => s.show);

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

  function buildOutgoing(userText: string): string {
    const skill = activeSkill ? SKILLS.find((s) => s.id === activeSkill) : null;
    const head = skill ? `${skill.prefix}${userText}` : userText;
    if (attachments.length === 0) return head;
    const blocks = attachments
      .map((a) => {
        const note =
          a.truncatedRows > 0
            ? `\n_(showing first rows; ${a.truncatedRows} more rows omitted)_`
            : "";
        return `\n\n**Attached: \`${a.name}\`**${note}\n\n${a.body}`;
      })
      .join("");
    return `${head}${blocks}`;
  }

  function submit() {
    const v = value.trim();
    if ((!v && attachments.length === 0) || disabled) return;
    const outgoing = buildOutgoing(v);
    setValue("");
    setActiveSkill(null);
    setAttachments([]);
    requestAnimationFrame(autoGrow);
    onSend(outgoing);
  }

  function pickSkill(s: Skill) {
    setActiveSkill((curr) => (curr === s.id ? null : s.id));
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (!/\.csv$/i.test(f.name)) {
        showToast(`${f.name}: only .csv files are supported right now.`);
        continue;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        showToast(`${f.name}: file is over 2 MB; please trim it down.`);
        continue;
      }
      try {
        const text = await f.text();
        const grid = parseCsv(text);
        const { table, truncatedRows } = gridToMarkdownTable(grid, {
          maxRows: 50,
          maxFieldLen: 80,
        });
        next.push({
          id: `${f.name}-${f.size}-${Date.now().toString(36)}`,
          name: f.name,
          bytes: f.size,
          body: table || "_(empty file)_",
          truncatedRows,
        });
      } catch {
        showToast(`${f.name}: couldn't parse this file.`);
      }
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);
      requestAnimationFrame(() => taRef.current?.focus());
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  const activeSkillObj = activeSkill
    ? SKILLS.find((s) => s.id === activeSkill)
    : null;
  const hasPills = !!activeSkillObj || attachments.length > 0;
  const canSend = value.trim().length > 0 || attachments.length > 0;

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
        aria-disabled={disabled || undefined}
        className={cn(
          "relative mx-auto max-w-[920px] overflow-hidden rounded-[20px]",
          "border border-[var(--stroke-2)] bg-[var(--panel)]",
          // Theme-aware base shadow — softer than before so the shell lifts
          // off the chat without bruising the page in light mode.
          "shadow-[var(--shadow-2)]",
          "transition-[border-color,box-shadow,opacity] duration-200",
          // Hover: subtle border bump, no shadow change yet.
          "hover:border-[color:color-mix(in_oklab,var(--stroke-2)_70%,var(--accent)_30%)]",
          // Focus: full accent border + 4px accent-soft ring stacked on the base shadow.
          "focus-within:!border-[var(--accent)]/70",
          "focus-within:shadow-[0_0_0_4px_var(--accent-soft),var(--shadow-2)]",
          // Whole composer goes dim & non-interactive while a request is in flight.
          disabled && "pointer-events-none opacity-60"
        )}
      >
        {/* Toolbar — small skill chips, hairline divider below */}
        <div
          className="flex items-center gap-1 border-b border-[var(--stroke)] px-2 py-1.5"
          role="toolbar"
          aria-label="Input helpers"
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-0.5",
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
                    aria-pressed={active}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium",
                      "transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : // Resting state intentionally muted so skills don't fight the textarea
                          "text-[var(--muted-2)] hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
                    )}
                  >
                    <s.Icon
                      size={13}
                      className={cn(
                        "shrink-0",
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

        {/* Pills row — only renders when there's something staged. */}
        <AnimatePresence initial={false}>
          {hasPills && (
            <motion.div
              key="pills"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
              className="overflow-hidden border-b border-[var(--stroke)]"
            >
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                {activeSkillObj && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--stroke-accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--accent)]">
                    <activeSkillObj.Icon size={11} />
                    {activeSkillObj.label}
                    <button
                      type="button"
                      onClick={() => setActiveSkill(null)}
                      aria-label={`Remove ${activeSkillObj.label} skill`}
                      className="grid h-4 w-4 place-items-center rounded-full text-[var(--accent)]/80 transition-colors hover:bg-[var(--accent)]/20 hover:text-[var(--accent)]"
                    >
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  </span>
                )}
                {attachments.map((a) => (
                  <Tooltip
                    key={a.id}
                    label={
                      a.truncatedRows > 0
                        ? `${fmtBytes(a.bytes)} · ${a.truncatedRows} rows truncated`
                        : fmtBytes(a.bytes)
                    }
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--stroke)] bg-[var(--hover-soft)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--text)]">
                      <FileSpreadsheet
                        size={11}
                        className="text-[var(--accent)]"
                      />
                      <span className="max-w-[180px] truncate">{a.name}</span>
                      <span className="num font-mono text-[10px] text-[var(--muted-3)]">
                        {fmtBytes(a.bytes)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        aria-label={`Remove ${a.name}`}
                        className="grid h-4 w-4 place-items-center rounded-full text-[var(--muted-2)] transition-colors hover:bg-[var(--hover-stronger)] hover:text-[var(--text)]"
                      >
                        <X size={10} strokeWidth={2.5} />
                      </button>
                    </span>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="flex items-end gap-1.5 px-2 py-2 sm:gap-2 sm:px-3 sm:py-2.5">
          <div className="flex shrink-0 items-end pb-px">
            <Tooltip label="Attach CSV">
              <button
                type="button"
                onClick={openFilePicker}
                aria-label="Attach CSV file"
                className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--hover-soft)] hover:text-[var(--text)]"
              >
                <Paperclip size={16} strokeWidth={2} />
              </button>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={(e) => onFilesPicked(e.target.files)}
            />
          </div>

          <textarea
            ref={taRef}
            rows={1}
            placeholder="Ask about earnings, filings, valuations…"
            disabled={disabled}
            className={cn(
              "min-h-[40px] max-h-[220px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[15px] leading-[1.55] outline-none",
              "text-[var(--text)] placeholder:text-[var(--muted-3)]",
              "[caret-color:var(--accent)]",
              "disabled:cursor-not-allowed"
            )}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            aria-label="Message"
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
                  className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--stroke-2)] bg-[var(--hover-soft)] text-[var(--text)] transition-colors hover:bg-[var(--hover-stronger)]"
                >
                  <Square size={13} strokeWidth={2.5} />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  type="button"
                  onClick={submit}
                  disabled={!canSend || disabled}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.14 }}
                  aria-label="Send"
                  title="Send · Enter"
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg transition-[opacity,filter,transform]",
                    canSend && !disabled
                      ? "bg-[var(--accent)] text-[var(--on-accent)] hover:brightness-110 active:translate-y-[0.5px]"
                      : "cursor-not-allowed bg-[var(--hover-soft)] text-[var(--muted-3)]"
                  )}
                >
                  <Send size={15} strokeWidth={2.25} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
});
