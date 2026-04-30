"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

/**
 * Custom-styled dropdown that replaces the native `<select>` so it matches
 * the rest of the analytics UI in both light and dark themes.
 *
 * - Click trigger toggles a popover menu below it
 * - Arrow up/down / Enter / Escape keyboard navigation
 * - Click outside closes
 * - Selected option shows a check + accent text
 * - Width matches the trigger so it never feels lopsided
 *
 * Behaviorally a drop-in for the previous `<select>` — pass `value` and
 * `onChange(value)` and it works the same way.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  minWidth = 140,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
  placeholder?: string;
  minWidth?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value) || null;

  // Re-sync highlight when value changes externally (e.g. preset cleared).
  useEffect(() => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx >= 0) setHighlight(idx);
  }, [value, options]);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep highlighted option in view when navigating via keyboard.
  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function commit(idx: number) {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKey(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(highlight);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div
      ref={wrapRef}
      className={cn("relative", className)}
      style={{ minWidth }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-[10px] border border-[var(--stroke)] bg-[var(--hover-soft)] px-2.5 text-left text-[12.5px] transition-colors",
          "hover:border-[var(--stroke-2)] hover:bg-[var(--hover-stronger)]",
          "focus:border-[var(--accent)]/60 focus:outline-none",
          open && "border-[var(--accent)]/60 bg-[var(--hover-stronger)]"
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            selected ? "text-[var(--text)]" : "text-[var(--muted-3)]"
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-[var(--muted-2)] transition-transform",
            open && "rotate-180 text-[var(--accent)]"
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          autoFocus
          onKeyDown={onListKey}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[260px] overflow-auto rounded-[10px] border border-[var(--stroke-2)] bg-[var(--panel-2)] p-1 shadow-[var(--shadow-2)] outline-none"
          style={{ minWidth }}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const isHighlight = i === highlight;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  // Use mousedown so we beat the trigger's outside-click handler.
                  e.preventDefault();
                  commit(i);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors",
                  isHighlight
                    ? "bg-[var(--accent-soft)] text-[var(--text)]"
                    : "text-[var(--muted)]",
                  isSelected && "text-[var(--accent)]"
                )}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {isSelected && (
                  <Check size={13} className="shrink-0 text-[var(--accent)]" />
                )}
              </li>
            );
          })}
          {options.length === 0 && (
            <li className="px-2 py-2 text-[12px] text-[var(--muted-3)]">
              No options
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
