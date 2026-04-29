"use client";

import {
  Menu,
  Moon,
  Sun,
  Settings as SettingsIcon,
  Search,
  ArrowLeft,
  MoreHorizontal,
  BarChart3,
  Eraser,
  Download,
  MessageSquare,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

type Props = {
  title: string;
  scrolled?: boolean;
  inConversation?: boolean;
  onMenu: () => void;
  onHome: () => void;
  onAnalytics: () => void;
  onFeedback: () => void;
  onClear: () => void;
  onExport: () => void;
  onSettings: () => void;
  onCommand: () => void;
};

export function Topbar({
  title,
  scrolled,
  inConversation,
  onMenu,
  onHome,
  onAnalytics,
  onFeedback,
  onClear,
  onExport,
  onSettings,
  onCommand,
}: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!moreOpen) return;
      const el = moreRef.current;
      if (el && !el.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--stroke)] bg-[var(--glass)] px-4 py-3 backdrop-blur-md transition-shadow",
        scrolled && "topbar-scrolled"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenu}
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] hover:bg-white/5 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={16} />
        </button>

        {inConversation && (
          <Tooltip label="Back to home">
            <button
              type="button"
              onClick={onHome}
              aria-label="Back to home"
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
            >
              <ArrowLeft size={15} />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip label="Search · Ctrl+K">
          <button
            type="button"
            onClick={onCommand}
            aria-label="Search"
            className="hidden h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)] md:grid"
          >
            <Search size={14} />
          </button>
        </Tooltip>

        <Tooltip label="Analytics">
          <button
            type="button"
            onClick={onAnalytics}
            aria-label="Analytics"
            className="hidden h-9 items-center gap-1.5 rounded-[10px] border border-[var(--stroke)] px-2.5 text-[13px] font-semibold text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)] md:inline-flex"
          >
            <BarChart3 size={13} />
            Analytics
          </button>
        </Tooltip>

        <Sep />

        <Tooltip label="Toggle theme">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(mounted && theme === "light" ? "dark" : "light")
            }
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
          >
            {mounted && theme === "light" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </Tooltip>

        <Tooltip label="Settings">
          <button
            type="button"
            aria-label="Settings"
            onClick={onSettings}
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
          >
            <SettingsIcon size={15} />
          </button>
        </Tooltip>

        {/* More menu */}
        <div className="relative" ref={moreRef}>
          <Tooltip label="More">
            <button
              type="button"
              aria-label="More"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--stroke)] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]",
                moreOpen && "bg-white/5 text-[var(--text)]"
              )}
            >
              <MoreHorizontal size={15} />
            </button>
          </Tooltip>
          {moreOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-20 w-[200px] overflow-hidden rounded-[12px] border border-[var(--stroke-2)] bg-[var(--glass-2)] py-1 shadow-[var(--shadow-2)] backdrop-blur-md ring-inset-soft"
            >
              <MenuItem
                Icon={Eraser}
                label="Clear chat"
                onClick={() => {
                  setMoreOpen(false);
                  onClear();
                }}
              />
              <MenuItem
                Icon={Download}
                label="Export as Markdown"
                onClick={() => {
                  setMoreOpen(false);
                  onExport();
                }}
              />
              <Divider />
              <MenuItem
                Icon={MessageSquare}
                label="Send feedback"
                onClick={() => {
                  setMoreOpen(false);
                  onFeedback();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  Icon,
  label,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"
    >
      <Icon size={13} className="text-[var(--muted-2)]" />
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[var(--stroke)]" />;
}

function Sep() {
  return (
    <span
      aria-hidden
      className="mx-1 inline-block h-[18px] w-px bg-[var(--stroke)]"
    />
  );
}
