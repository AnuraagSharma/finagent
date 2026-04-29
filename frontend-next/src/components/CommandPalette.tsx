"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Compass,
  FilePlus,
  History,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRecents } from "@/lib/stores";
import { cn } from "@/lib/cn";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onResume: (threadId: string, title: string) => void;
  onPickPrompt: (text: string) => void;
  onOpenSettings: () => void;
};

export function CommandPalette({
  open,
  onClose,
  onNewChat,
  onResume,
  onPickPrompt,
  onOpenSettings,
}: Props) {
  const recents = useRecents((s) => s.recents);
  const [q, setQ] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQ("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Esc to close handled at parent (page) too
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const quickActions: Action[] = useMemo(
    () => [
      {
        id: "new",
        label: "New chat",
        hint: "Start a fresh conversation",
        icon: <FilePlus size={14} />,
        onSelect: () => {
          onNewChat();
          onClose();
        },
      },
      {
        id: "settings",
        label: "Open settings",
        hint: "Configure user id and backend URL",
        icon: <SettingsIcon size={14} />,
        onSelect: () => {
          onOpenSettings();
          onClose();
        },
      },
      {
        id: "explore",
        label: "Explore stock market trends",
        hint: "Prefill prompt",
        icon: <Compass size={14} />,
        onSelect: () => {
          onPickPrompt("Explain stock market trends briefly");
          onClose();
        },
      },
      {
        id: "compare",
        label: "Compare NVDA vs AMD",
        hint: "Profitability · valuation · growth",
        icon: <Sparkles size={14} />,
        onSelect: () => {
          onPickPrompt(
            "Compare NVDA vs AMD: profitability, valuation, growth, and risk in a clean table."
          );
          onClose();
        },
      },
    ],
    [onClose, onNewChat, onOpenSettings, onPickPrompt]
  );

  const filteredActions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return quickActions;
    return quickActions.filter((a) =>
      `${a.label} ${a.hint || ""}`.toLowerCase().includes(s)
    );
  }, [q, quickActions]);

  const filteredRecents = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = !s
      ? recents
      : recents.filter(
          (r) =>
            (r.title || "").toLowerCase().includes(s) ||
            r.threadId.toLowerCase().includes(s)
        );
    return list.slice(0, 8);
  }, [q, recents]);

  const flat = useMemo(
    () =>
      [
        ...filteredActions.map((a) => ({ kind: "action" as const, action: a })),
        ...filteredRecents.map((r) => ({ kind: "recent" as const, recent: r })),
      ] as Array<
        | { kind: "action"; action: Action }
        | { kind: "recent"; recent: (typeof filteredRecents)[number] }
      >,
    [filteredActions, filteredRecents]
  );

  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(0);
  }, [flat, activeIndex]);

  function selectIndex(i: number) {
    const it = flat[i];
    if (!it) return;
    if (it.kind === "action") it.action.onSelect();
    else {
      onResume(it.recent.threadId, it.recent.title);
      onClose();
    }
  }

  function onKeyInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectIndex(activeIndex);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cp-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-md"
          />
          <div className="fixed inset-0 z-50 grid place-items-start justify-center p-4 pt-[12vh]">
            <motion.div
              key="cp"
              initial={{ opacity: 0, y: -10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985 }}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
              className="w-full max-w-[640px] overflow-hidden rounded-[16px] border border-[var(--stroke-2)] bg-[var(--glass-2)] shadow-[var(--shadow-1)] backdrop-blur-md ring-inset-soft"
            >
              <div className="flex items-center gap-2.5 border-b border-[var(--stroke)] px-3.5 py-3">
                <Search size={15} className="text-[var(--muted-2)]" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKeyInput}
                  placeholder="Search chats or run a command…"
                  className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--muted-3)]"
                />
                <span className="text-[10.5px] text-[var(--muted-3)]">
                  <span className="kbd">esc</span> close
                </span>
              </div>

              <div className="scroll-area max-h-[60vh] overflow-auto px-1 py-2">
                {filteredActions.length > 0 && (
                  <Section
                    label="Actions"
                    indexBase={0}
                    activeIndex={activeIndex}
                    items={filteredActions.map((a) => ({
                      key: a.id,
                      icon: a.icon,
                      title: a.label,
                      hint: a.hint || "",
                      onSelect: a.onSelect,
                    }))}
                    onHover={setActiveIndex}
                  />
                )}
                {filteredRecents.length > 0 && (
                  <Section
                    label="Recent chats"
                    indexBase={filteredActions.length}
                    activeIndex={activeIndex}
                    items={filteredRecents.map((r) => ({
                      key: r.threadId,
                      icon: <History size={14} />,
                      title: r.title || "Untitled",
                      hint: r.threadId.slice(0, 8) + "…",
                      onSelect: () => {
                        onResume(r.threadId, r.title);
                        onClose();
                      },
                    }))}
                    onHover={setActiveIndex}
                  />
                )}
                {flat.length === 0 && (
                  <div className="px-3 py-6 text-center text-[13px] text-[var(--muted-2)]">
                    No matches.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--stroke)] px-3.5 py-2 text-[11px] text-[var(--muted-2)]">
                <span>
                  <span className="kbd">↑</span>
                  <span className="kbd">↓</span> navigate{" "}
                  <span className="kbd">enter</span> select
                </span>
                <span>
                  Open with <span className="kbd">Ctrl</span>+
                  <span className="kbd">K</span>
                </span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  label,
  items,
  activeIndex,
  indexBase,
  onHover,
}: {
  label: string;
  items: {
    key: string;
    icon?: React.ReactNode;
    title: string;
    hint: string;
    onSelect: () => void;
  }[];
  activeIndex: number;
  indexBase: number;
  onHover: (i: number) => void;
}) {
  return (
    <div className="mb-1.5">
      <div className="px-3 pb-1 pt-1 text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted-3)]">
        {label}
      </div>
      {items.map((it, i) => {
        const idx = indexBase + i;
        const active = idx === activeIndex;
        return (
          <button
            key={it.key}
            type="button"
            onMouseEnter={() => onHover(idx)}
            onClick={it.onSelect}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px]",
              active
                ? "bg-[var(--accent-soft)] text-[var(--text)]"
                : "text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--stroke)] bg-white/[0.04] text-[var(--muted-2)]">
              {it.icon}
            </span>
            <span className="flex-1 truncate">{it.title}</span>
            <span className="truncate text-[11.5px] text-[var(--muted-3)]">
              {it.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
